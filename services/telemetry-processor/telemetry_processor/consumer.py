"""
Main Kafka consumer loop for the telemetry-processor.

Consumes from `iot.telemetry.raw`, feeds readings into the Aggregator,
and runs a periodic flush that checks for anomalies and persists aggregates.
"""
import asyncio
import json
import logging
import os
from typing import Dict, Optional

from aiokafka import AIOKafkaConsumer, TopicPartition

from .aggregator import Aggregator
from .anomaly import AnomalyDetector
from .db import store_device_reading, store_anomaly
from .fault import fault_state
from .publisher import AnomalyPublisher

logger = logging.getLogger(__name__)

# Separate logger for Dynatrace Business Events extraction.
# Outputs JSON via the pythonjsonlogger formatter configured in main.py.
biz_logger = logging.getLogger("BusinessEvents")


class TelemetryConsumer:
    def __init__(self) -> None:
        self.bootstrap_servers = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:9092")
        self.raw_topic = os.getenv("KAFKA_RAW_TOPIC", "iot.telemetry.raw")
        self.group_id = "telemetry-processor"

        self.aggregator = Aggregator(window_seconds=60)
        self.detector = AnomalyDetector()
        self.publisher = AnomalyPublisher(self.bootstrap_servers)

        self._consumer: Optional[AIOKafkaConsumer] = None
        self._running = False

        # In-memory cache: device_id → {device_type, device_category, zone}
        self._device_meta: Dict[str, dict] = {}

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    @property
    def running(self) -> bool:
        """Whether the consume loop is currently active (cheap, sync)."""
        return self._running

    async def start(self) -> None:
        await self.publisher.start()
        self._consumer = AIOKafkaConsumer(
            self.raw_topic,
            bootstrap_servers=self.bootstrap_servers,
            group_id=self.group_id,
            auto_offset_reset="earliest",
            enable_auto_commit=True,
            value_deserializer=lambda v: json.loads(v.decode("utf-8")),
        )
        await self._consumer.start()
        self._running = True
        logger.info(
            "Telemetry consumer started",
            extra={"kafka.topic": self.raw_topic, "kafka.group": self.group_id},
        )

    async def run(self) -> None:
        """Blocking consumption loop. Runs until stop() is called."""
        flush_task = asyncio.create_task(self._periodic_flush())
        try:
            async for msg in self._consumer:
                if not self._running:
                    break
                if fault_state.memory_pressure_enabled:
                    fault_state.apply_memory_pressure()
                try:
                    await self._process_message(msg.value)
                except Exception as exc:
                    logger.error(
                        "Error processing message",
                        extra={"error": str(exc), "offset": msg.offset},
                    )
        finally:
            flush_task.cancel()
            try:
                await flush_task
            except asyncio.CancelledError:
                pass
            await self.stop()

    async def stop(self) -> None:
        self._running = False
        if self._consumer:
            await self._consumer.stop()
        await self.publisher.stop()
        logger.info("Telemetry consumer stopped")

    # ------------------------------------------------------------------
    # Message processing
    # ------------------------------------------------------------------

    async def _process_message(self, data: dict) -> None:
        device_id = data.get("device_id", "unknown")
        metrics: dict = data.get("metrics", {})
        device_type = data.get("device_type", "")
        device_category = data.get("device_category") or device_type
        zone = data.get("zone", "")

        # Cache device metadata (first-seen wins)
        if device_id not in self._device_meta:
            self._device_meta[device_id] = {
                "device_type": device_type,
                "device_category": device_category,
                "zone": zone,
            }

        await self.aggregator.record(
            device_id, metrics,
            device_type=device_type,
            zone=zone,
        )

    # ------------------------------------------------------------------
    # Periodic aggregation flush + anomaly check
    # ------------------------------------------------------------------

    async def _periodic_flush(self) -> None:
        """Flush completed 1-minute windows every 60 seconds."""
        while True:
            await asyncio.sleep(60)
            try:
                await self._flush_windows()
            except Exception as exc:
                logger.error("Flush error", extra={"error": str(exc)})

    async def _flush_windows(self) -> None:
        completed = await self.aggregator.flush_completed_windows()
        for window in completed:
            device_id = window["device_id"]
            meta = self._device_meta.get(device_id, {})
            window.setdefault("device_type", meta.get("device_type", ""))
            window.setdefault("zone", meta.get("zone", ""))
            category = meta.get("device_category", "")

            # Persist aggregate
            try:
                await store_device_reading(window)
            except Exception as exc:
                logger.error(
                    "DB write error",
                    extra={"device_id": device_id, "metric": window["metric_name"], "error": str(exc)},
                )

            # Anomaly detection
            anomaly = self.detector.check(
                device_id,
                category,
                window["metric_name"],
                window["avg"],
            )
            if anomaly:
                await self._handle_anomaly(anomaly)

    async def _handle_anomaly(self, anomaly: dict) -> None:
        device_id = anomaly["device_id"]
        metric_name = anomaly["metric_name"]

        logger.warning(
            "Anomaly detected",
            extra={
                "device_id": device_id,
                "metric_name": metric_name,
                "value": anomaly["avg_value"],
                "threshold": anomaly["threshold"],
            },
        )

        # Persist to PostgreSQL
        anomaly_id = -1
        try:
            anomaly_id = await store_anomaly(anomaly)
            self.detector.mark_active((device_id, metric_name), anomaly_id)
        except Exception as exc:
            logger.error("Anomaly DB write error", extra={"error": str(exc)})

        # Emit Dynatrace Business Event via structured log
        biz_logger.info(
            "iot.anomaly_detected",
            extra={
                "event.type": "iot.anomaly_detected",
                "device.id": device_id,
                "device.category": anomaly.get("device_category", ""),
                "anomaly.type": anomaly.get("anomaly_type", ""),
                "metric.name": metric_name,
                "metric.value": anomaly["avg_value"],
                "threshold": anomaly["threshold"],
                "anomaly.id": anomaly_id,
            },
        )

        # Publish to Kafka iot.anomalies for city-operations and notification-service
        await self.publisher.publish_anomaly({
            "device_id": device_id,
            "device_type": anomaly.get("device_category", ""),
            "anomaly_type": anomaly.get("anomaly_type", metric_name),
            "metric_name": metric_name,
            "value": anomaly["avg_value"],
            "threshold": anomaly["threshold"],
            "severity": "warning",
        })

    # ------------------------------------------------------------------
    # Observability helpers (used by the FastAPI status endpoint)
    # ------------------------------------------------------------------

    async def get_consumer_lag(self) -> dict:
        if not self._consumer:
            return {}
        try:
            partitions = self._consumer.assignment()
            lag_info = {}
            for tp in partitions:
                committed = await self._consumer.committed(tp)
                end_offsets = await self._consumer.end_offsets([tp])
                end = end_offsets.get(tp, 0)
                lag_info[f"{tp.topic}:{tp.partition}"] = {
                    "committed": committed or 0,
                    "end": end,
                    "lag": max(0, end - (committed or 0)),
                }
            return lag_info
        except Exception as exc:
            return {"error": str(exc)}

    async def get_status(self) -> dict:
        lag = await self.get_consumer_lag()
        device_count = await self.aggregator.current_device_count()
        return {
            "running": self._running,
            "group_id": self.group_id,
            "topic": self.raw_topic,
            "active_devices": device_count,
            "active_anomalies": self.detector.active_anomaly_count(),
            "consumer_lag": lag,
            "faults": {
                "memory_pressure": fault_state.memory_pressure_enabled,
            },
        }

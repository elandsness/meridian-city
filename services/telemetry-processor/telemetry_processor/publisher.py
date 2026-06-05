"""
Kafka publisher for detected IoT anomalies.

Publishes to the `iot.anomalies` topic, which is consumed by:
  - city-operations (creates incidents and work orders)
  - notification-service (sends in-app alerts)
"""
import json
import logging
from typing import Optional

from aiokafka import AIOKafkaProducer

logger = logging.getLogger(__name__)


class AnomalyPublisher:
    def __init__(self, bootstrap_servers: str, topic: str = "iot.anomalies") -> None:
        self.bootstrap_servers = bootstrap_servers
        self.topic = topic
        self._producer: Optional[AIOKafkaProducer] = None

    async def start(self) -> None:
        self._producer = AIOKafkaProducer(
            bootstrap_servers=self.bootstrap_servers,
            value_serializer=lambda v: json.dumps(v).encode("utf-8"),
            key_serializer=lambda k: k.encode("utf-8") if k else None,
            # Retry on transient Kafka errors
            request_timeout_ms=10_000,
            retry_backoff_ms=500,
        )
        await self._producer.start()
        logger.info(
            "Anomaly publisher connected",
            extra={"kafka.servers": self.bootstrap_servers, "kafka.topic": self.topic},
        )

    async def publish_anomaly(self, anomaly: dict) -> None:
        """Publish a detected anomaly to the iot.anomalies Kafka topic."""
        if self._producer is None:
            logger.warning("Publisher not started — anomaly not sent")
            return
        try:
            await self._producer.send(
                self.topic,
                key=anomaly.get("device_id"),
                value=anomaly,
            )
            logger.debug(
                "Anomaly published",
                extra={"device_id": anomaly.get("device_id"), "topic": self.topic},
            )
        except Exception as exc:
            logger.error(
                "Failed to publish anomaly",
                extra={"device_id": anomaly.get("device_id"), "error": str(exc)},
            )

    async def stop(self) -> None:
        if self._producer:
            await self._producer.stop()
            logger.info("Anomaly publisher stopped")

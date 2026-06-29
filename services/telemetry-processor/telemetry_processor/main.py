"""
Entry point for the telemetry-processor.

Wires together:
  - JSON-structured logging (standard library + python-json-logger)
  - PostgreSQL schema initialisation
  - Kafka consumer (background asyncio task)
  - FastAPI app served by uvicorn
"""
import asyncio
import logging
import os
import sys
import time

import uvicorn
from pythonjsonlogger import jsonlogger

from .api import app, set_consumer
from .consumer import TelemetryConsumer
from .db import init_db, close
from .otel import init_otel


# ---------------------------------------------------------------------------
# Logging setup — JSON format so OneAgent / Dynatrace can parse structured fields
# ---------------------------------------------------------------------------

def configure_logging() -> None:
    log_level = os.getenv("LOG_LEVEL", "INFO").upper()

    formatter = jsonlogger.JsonFormatter(
        fmt="%(asctime)s %(levelname)s %(name)s %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
    )

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)

    root = logging.getLogger()
    root.setLevel(log_level)
    root.handlers.clear()
    root.addHandler(handler)

    # BusinessEvents logger — same handler, dedicated name for DT log rule matching
    biz = logging.getLogger("BusinessEvents")
    biz.propagate = True  # inherits the root handler


# Configure logging + OpenTelemetry at import time — BEFORE uvicorn serves the app.
# FastAPIInstrumentor must add its middleware before the ASGI app starts (the startup
# hook is too late), and aiokafka must be instrumented before the consumer is created
# in the startup hook below.
configure_logging()
try:
    init_otel(app)
except Exception as exc:
    logging.getLogger(__name__).warning("OTel init failed — tracing disabled: %s", exc)


# ---------------------------------------------------------------------------
# FastAPI lifecycle hooks
# ---------------------------------------------------------------------------

_consumer_instance: TelemetryConsumer = None  # type: ignore
_supervisor_task: asyncio.Task = None  # type: ignore
_shutdown = asyncio.Event()

# Restart-backoff bounds for the consumer supervisor.
_RESTART_BACKOFF_MAX_S = 30.0
# If the consumer ran at least this long before exiting, treat it as a healthy
# run and recover fast (reset backoff) rather than escalating.
_HEALTHY_UPTIME_S = 60.0


async def _safe_stop(consumer: TelemetryConsumer) -> None:
    """Best-effort consumer teardown — never raises (stop may already have run)."""
    try:
        await consumer.stop()
    except Exception:
        pass


async def _supervise_consumer() -> None:
    """Keep a TelemetryConsumer running for the lifetime of the process.

    The Kafka consumer is the heart of the pipeline (telemetry → anomaly →
    iot.anomalies → city-operations incident). It used to run as a single
    fire-and-forget task: if start() failed (e.g. Kafka not ready at boot) or the
    run() loop ever exited/raised (broker rebalance, transient disconnect), the
    task ended, ``running`` stayed False, and nothing restarted it — the pipeline
    silently stopped until someone manually restarted the pod, while /health kept
    returning 200. This supervisor restarts the consumer with exponential backoff
    so a transient failure self-heals instead of becoming permanent.
    """
    global _consumer_instance
    logger = logging.getLogger(__name__)
    backoff = 1.0

    while not _shutdown.is_set():
        consumer = TelemetryConsumer()
        _consumer_instance = consumer
        set_consumer(consumer)
        started = time.monotonic()

        try:
            await consumer.start()
            logger.info("Kafka consumer started")
            await consumer.run()  # blocks until the consume loop ends; cleans up itself
        except asyncio.CancelledError:
            await _safe_stop(consumer)
            raise
        except Exception as exc:
            logger.error("Kafka consumer failed", extra={"error": str(exc)})
            await _safe_stop(consumer)

        if _shutdown.is_set():
            break

        # Reset backoff after a healthy run; otherwise grow it so we don't hammer
        # a broker that is down.
        if time.monotonic() - started >= _HEALTHY_UPTIME_S:
            backoff = 1.0
        logger.warning(
            "Kafka consumer stopped — restarting",
            extra={"backoff_seconds": backoff},
        )
        try:
            # Sleep, but wake immediately if shutdown is requested.
            await asyncio.wait_for(_shutdown.wait(), timeout=backoff)
        except asyncio.TimeoutError:
            pass
        backoff = min(backoff * 2, _RESTART_BACKOFF_MAX_S)

    logger.info("Consumer supervisor exiting")


@app.on_event("startup")
async def startup() -> None:
    global _supervisor_task

    logger = logging.getLogger(__name__)
    logger.info("telemetry-processor starting")

    # Init PostgreSQL schema (best-effort — the consumer still publishes anomalies
    # to Kafka even if these side-channel DB writes fail).
    try:
        await init_db()
    except Exception as exc:
        logger.error("DB init failed — continuing without PostgreSQL", extra={"error": str(exc)})

    # Run the Kafka consumer under a supervisor so a crash or failed start
    # self-heals instead of permanently stalling the pipeline.
    _supervisor_task = asyncio.create_task(
        _supervise_consumer(), name="consumer-supervisor"
    )
    logger.info("Consumer supervisor started")


@app.on_event("shutdown")
async def shutdown() -> None:
    global _supervisor_task
    logger = logging.getLogger(__name__)
    logger.info("telemetry-processor shutting down")

    _shutdown.set()
    if _supervisor_task and not _supervisor_task.done():
        _supervisor_task.cancel()
        try:
            await _supervisor_task
        except asyncio.CancelledError:
            pass

    await close()
    logger.info("shutdown complete")


# ---------------------------------------------------------------------------
# Standalone entrypoint
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8086"))
    # Pass the app object (not "module:app") so uvicorn does not re-import this
    # module — the `python -m ...` entrypoint + an import string would load main
    # twice and register the startup hook (DB init, Kafka consumer) twice.
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=port,
        log_config=None,  # We configure logging ourselves above
    )

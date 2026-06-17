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
_consumer_task: asyncio.Task = None  # type: ignore


@app.on_event("startup")
async def startup() -> None:
    global _consumer_instance, _consumer_task

    logger = logging.getLogger(__name__)
    logger.info("telemetry-processor starting")

    # Init PostgreSQL schema
    try:
        await init_db()
    except Exception as exc:
        logger.error("DB init failed — continuing without PostgreSQL", extra={"error": str(exc)})

    # Start Kafka consumer as a background task
    _consumer_instance = TelemetryConsumer()
    set_consumer(_consumer_instance)

    try:
        await _consumer_instance.start()
        _consumer_task = asyncio.create_task(
            _consumer_instance.run(), name="telemetry-consumer"
        )
        logger.info("Kafka consumer task started")
    except Exception as exc:
        logger.error("Kafka consumer failed to start", extra={"error": str(exc)})


@app.on_event("shutdown")
async def shutdown() -> None:
    global _consumer_task
    logger = logging.getLogger(__name__)
    logger.info("telemetry-processor shutting down")

    if _consumer_task and not _consumer_task.done():
        _consumer_task.cancel()
        try:
            await _consumer_task
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

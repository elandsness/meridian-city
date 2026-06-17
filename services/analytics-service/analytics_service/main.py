"""
Entry point for analytics-service.

Startup sequence:
  1. Configure JSON-structured logging
  2. Initialise PostgreSQL connection pool
  3. Create analytics schema + tables (idempotent)
  4. Seed fault state from env vars
  5. Start background KPI snapshot task (every SNAPSHOT_INTERVAL_SECONDS)

Shutdown:
  1. Cancel background task
  2. Close DB pool
"""
from __future__ import annotations

import asyncio
import logging
import os
import sys

import uvicorn
from pythonjsonlogger import jsonlogger

from .api import app, set_snapshot_cache
from .db import close as close_db, init_db
from .fault import fault_state
from .kpis import compute_kpis
from .otel import init_otel

logger = logging.getLogger(__name__)

SNAPSHOT_INTERVAL_SECONDS = int(os.getenv("SNAPSHOT_INTERVAL_SECONDS", "300"))  # 5 min


# ---------------------------------------------------------------------------
# Logging
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


# Configure logging + OpenTelemetry at import time — BEFORE uvicorn serves the app.
# FastAPIInstrumentor must add its middleware before the ASGI app starts; doing it in
# the startup hook is too late ("Cannot add middleware after an application has started"),
# which silently dropped all HTTP server spans.
configure_logging()
try:
    init_otel(app)
except Exception as exc:
    logger.warning("OTel init failed — tracing disabled: %s", exc)


# ---------------------------------------------------------------------------
# Background KPI snapshot task
# ---------------------------------------------------------------------------

_snapshot_task: asyncio.Task | None = None


async def _snapshot_loop() -> None:
    """Compute and cache KPIs every SNAPSHOT_INTERVAL_SECONDS. Non-fatal."""
    while True:
        try:
            snapshot = await compute_kpis()
            set_snapshot_cache(snapshot)

            from .db import save_kpi_snapshot
            await save_kpi_snapshot(snapshot)

            logger.debug("kpi snapshot stored", extra=snapshot)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.warning("kpi snapshot failed (non-fatal): %s", exc)

        await asyncio.sleep(SNAPSHOT_INTERVAL_SECONDS)


# ---------------------------------------------------------------------------
# FastAPI lifecycle hooks
# ---------------------------------------------------------------------------

@app.on_event("startup")
async def startup() -> None:
    global _snapshot_task

    # DB pool + schema
    try:
        await init_db()
        logger.info("DB initialised")
    except Exception as exc:
        logger.warning("DB init failed (non-fatal, retrying on first request): %s", exc)

    # Fault state from env
    fault_state.db_slowdown_enabled = (
        os.getenv("FAULT_DB_SLOWDOWN_ENABLED", "false").lower() == "true"
    )
    fault_state.db_slowdown_seconds = float(
        os.getenv("FAULT_DB_SLOWDOWN_SECONDS", "0")
    )
    fault_state.memory_pressure_enabled = (
        os.getenv("FAULT_MEMORY_PRESSURE_ENABLED", "false").lower() == "true"
    )

    # Initial snapshot (synchronous, so /kpis is ready immediately)
    try:
        snapshot = await compute_kpis()
        set_snapshot_cache(snapshot)
    except Exception as exc:
        logger.warning("initial KPI snapshot failed: %s", exc)

    # Background snapshot loop
    _snapshot_task = asyncio.create_task(_snapshot_loop())

    logger.info("analytics-service started")


@app.on_event("shutdown")
async def shutdown() -> None:
    logger.info("analytics-service shutting down")
    if _snapshot_task is not None:
        _snapshot_task.cancel()
        try:
            await _snapshot_task
        except asyncio.CancelledError:
            pass
    await close_db()
    logger.info("shutdown complete")


# ---------------------------------------------------------------------------
# Standalone entrypoint
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8084"))
    # Pass the app object (not "module:app") so uvicorn does not re-import this
    # module — the `python -m ...` entrypoint + an import string would load main
    # twice and register the startup hook (DB init, Kafka consumer) twice.
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=port,
        log_config=None,
    )

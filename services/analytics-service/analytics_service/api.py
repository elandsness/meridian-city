"""
FastAPI route definitions for analytics-service.

Endpoints:
  GET  /health                          — liveness check
  GET  /api/v1/kpis                     — current KPI snapshot
  GET  /api/v1/kpis/history             — historical KPI snapshots (?hours=24)
  GET  /api/v1/funnels/{name}           — funnel stage counts (service-request | account-creation | iot-incident)
  GET  /metrics                         — Prometheus text format for Dynatrace SRG scraping
  POST /admin/fault                     — runtime fault injection
"""
from __future__ import annotations

import os
from typing import List, Optional

from fastapi import FastAPI, HTTPException, Response
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field

from .fault import fault_state
from .funnels import FUNNEL_NAMES

app = FastAPI(title="Meridian City Analytics Service", version="1.0.0")

# Injected by main.py after startup
_snapshot_cache: Optional[dict] = None


def set_snapshot_cache(snapshot: dict) -> None:
    """Updated by the background snapshot task in main.py."""
    global _snapshot_cache
    _snapshot_cache = snapshot


def get_snapshot_cache() -> Optional[dict]:
    return _snapshot_cache


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class FaultRequest(BaseModel):
    db_slowdown_enabled: Optional[bool] = None
    db_slowdown_seconds: Optional[float] = Field(default=None, ge=0, le=60)
    memory_pressure_enabled: Optional[bool] = None


class FaultResponse(BaseModel):
    db_slowdown_enabled: bool
    db_slowdown_seconds: float
    memory_pressure_enabled: bool


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "analytics-service",
        "fault": {
            "db_slowdown_enabled": fault_state.db_slowdown_enabled,
            "memory_pressure_enabled": fault_state.memory_pressure_enabled,
        },
    }


@app.get("/api/v1/kpis")
async def get_kpis():
    """Return the latest KPI snapshot, recomputing live if no cached value exists."""
    from .kpis import compute_kpis

    cached = get_snapshot_cache()
    if cached is not None:
        return cached
    # First request before the background task has run — compute synchronously
    return await compute_kpis()


@app.get("/api/v1/kpis/history")
async def get_kpis_history(hours: int = 24):
    """Return historical KPI snapshots from the DB."""
    from .db import load_kpi_history
    if hours < 1 or hours > 168:
        raise HTTPException(status_code=400, detail="hours must be between 1 and 168")
    rows = await load_kpi_history(hours)
    return {"snapshots": rows, "count": len(rows)}


@app.get("/api/v1/funnels/{funnel_name}")
async def get_funnel(funnel_name: str):
    """Return stage-by-stage event counts for a named Business Analytics funnel."""
    if funnel_name not in FUNNEL_NAMES:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown funnel '{funnel_name}'. Available: {FUNNEL_NAMES}",
        )
    from .funnels import get_funnel as _get_funnel
    stages = await _get_funnel(funnel_name)
    return {"funnel": funnel_name, "stages": stages}


@app.get("/metrics", response_class=PlainTextResponse)
async def prometheus_metrics():
    """
    Prometheus text format for Dynatrace Site Reliability Guardian scraping.
    Returns latest KPI snapshot as gauges.
    """
    from .kpis import compute_kpis
    from .prometheus import render

    kpis = get_snapshot_cache() or await compute_kpis()
    return Response(content=render(kpis), media_type="text/plain; version=0.0.4")


@app.post("/admin/fault", response_model=FaultResponse)
async def inject_fault(request: FaultRequest):
    if request.db_slowdown_enabled is not None:
        fault_state.db_slowdown_enabled = request.db_slowdown_enabled
        if request.db_slowdown_enabled and fault_state.db_slowdown_seconds == 0:
            fault_state.db_slowdown_seconds = 2.0

    if request.db_slowdown_seconds is not None:
        fault_state.db_slowdown_seconds = request.db_slowdown_seconds

    if request.memory_pressure_enabled is not None:
        fault_state.memory_pressure_enabled = request.memory_pressure_enabled
        if fault_state.memory_pressure_enabled:
            # Start a background loop that grows memory over time (rising curve),
            # not a one-shot allocation that leaves the working set flat.
            fault_state.start_memory_leak()
        else:
            fault_state.release_memory_pressure()

    return FaultResponse(
        db_slowdown_enabled=fault_state.db_slowdown_enabled,
        db_slowdown_seconds=fault_state.db_slowdown_seconds,
        memory_pressure_enabled=fault_state.memory_pressure_enabled,
    )

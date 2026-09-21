"""
FastAPI route definitions for analytics-service.
"""
from __future__ import annotations
import os
from typing import List, Optional
from fastapi import FastAPI, HTTPException, Response
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field

from .fault import fault_state

app = FastAPI(title="Meridian City Analytics Service", version="1.0.0")

_snapshot_cache: Optional[dict] = None

def set_snapshot_cache(snapshot: dict) -> None:
    global _snapshot_cache
    _snapshot_cache = snapshot

def get_snapshot_cache() -> Optional[dict]:
    return _snapshot_cache

class FaultRequest(BaseModel):
    db_slowdown_enabled: Optional[bool] = None
    db_slowdown_seconds: Optional[float] = Field(default=None, ge=0, le=3600)
    memory_pressure_enabled: Optional[bool] = None
    memory_pressure_cap_mb: Optional[int] = Field(default=None, ge=64, le=4096)
    memory_pressure_ramp_seconds: Optional[int] = Field(default=None, ge=0, le=3600)

class FaultResponse(BaseModel):
    db_slowdown_enabled: bool
    db_slowdown_seconds: float
    memory_pressure_enabled: bool
    memory_pressure_cap_mb: int
    memory_pressure_ramp_seconds: int

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "analytics-service",
        "fault": {
            "db_slowdown_enabled": fault_state.db_slowdown_enabled,
            "memory_pressure_enabled": fault_state.memory_pressure_enabled,
            "db_slowdown_seconds": fault_state.db_slowdown_seconds,
            "memory_pressure_cap_mb": fault_state.memory_pressure_cap_mb,
            "memory_pressure_ramp_seconds": fault_state.memory_pressure_ramp_seconds,
        },
    }

@app.get("/api/v1/kpis")
async def get_kpis():
    from .kpis import compute_kpis
    cached = get_snapshot_cache()
    if cached is not None:
        return cached
    return await compute_kpis()

@app.get("/api/v1/kpis/history")
async def get_kpis_history(hours: int = 24):
    from .db import load_kpi_history
    if hours < 1 or hours > 168:
        raise HTTPException(status_code=400, detail="hours must be between 1 and 168")
    rows = await load_kpi_history(hours)
    return {"snapshots": rows, "count": len(rows)}

@app.get("/api/v1/funnels/{funnel_name}")
async def get_funnel(funnel_name: str):
    from .funnels import get_funnel as _get_funnel
    stages = await _get_funnel(funnel_name)
    if not stages:
        raise HTTPException(
            status_code=404,
            detail=f"Funnel '{funnel_name}' not found or not defined in current industry config."
        )
    return {"funnel": funnel_name, "stages": stages}

@app.get("/metrics", response_class=PlainTextResponse)
async def prometheus_metrics():
    from .kpis import compute_kpis
    from .prometheus import render
    kpis = get_snapshot_cache() or await compute_kpis()
    return Response(content=render(kpis), media_type="text/plain", version="0.0.4")

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
            fault_state.start_memory_leak()
        else:
            fault_state.release_memory_pressure()
    elif (request.memory_pressure_cap_mb is not None or request.memory_pressure_ramp_seconds is not None) and fault_state.memory_pressure_enabled:
        fault_state.start_memory_leak()

    return FaultResponse(
        db_slowdown_enabled=fault_state.db_slowdown_enabled,
        db_slowdown_seconds= fault_state.db_slowdown_seconds,
        memory_pressure_enabled=fault_state.memory_pressure_enabled,
        memory_pressure_cap_mb=fault_state.memory_pressure_cap_mb,
        memory_pressure_ramp_seconds=fault_state.memory_pressure_ramp_seconds,
    )

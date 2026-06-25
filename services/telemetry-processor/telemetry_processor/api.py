"""
FastAPI routes for the telemetry-processor.

Endpoints:
  GET  /health            — liveness / readiness check
  GET  /api/v1/status     — Kafka consumer lag + aggregator state
  POST /admin/fault       — runtime fault injection
"""
import logging
import os

import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional

from .db import fetch_open_incidents_by_asset
from .fault import fault_state

logger = logging.getLogger(__name__)

IOT_SIMULATOR_URL = os.getenv("IOT_SIMULATOR_URL", "http://iot-simulator:8088")

# device-id prefixes match the simulator (fmt "%s-%03d") and the 5 demo zones.
_DEVICE_CATEGORIES = [("vehicles", "veh", "vehicle"), ("buildings", "bldg", "building"), ("machines", "mach", "machine")]
_ZONES = ["zone-north", "zone-south", "zone-east", "zone-west", "zone-central"]

app = FastAPI(
    title="Meridian Telemetry Processor",
    description="IoT telemetry aggregation, anomaly detection, and fault injection.",
    version="1.0.0",
)

# The consumer instance is attached at startup in main.py
_consumer = None  # type: ignore


def set_consumer(consumer) -> None:
    global _consumer
    _consumer = consumer


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "telemetry-processor",
        "memory_pressure": fault_state.memory_pressure_enabled,
    }


# ---------------------------------------------------------------------------
# Status
# ---------------------------------------------------------------------------

@app.get("/api/v1/status")
async def status():
    if _consumer is None:
        return {"error": "consumer not initialised"}
    return await _consumer.get_status()


# ---------------------------------------------------------------------------
# IoT device registry (aggregated view)
# ---------------------------------------------------------------------------

@app.get("/api/v1/devices")
async def devices():
    """Device list with live status + open-incident links.

    Combines the iot-simulator's live fleet (counts + per-device anomalies) with
    open incidents joined on asset_id (= device id). Used by the citizen IoT map
    and the ops fleet view.
    """
    fleet = {}
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{IOT_SIMULATOR_URL}/admin/fleet")
            if resp.status_code == 200:
                fleet = resp.json()
    except Exception as exc:  # simulator unreachable — return an empty fleet, not a 500
        logger.warning("fleet fetch failed: %s", exc)

    items = []
    for key, prefix, category in _DEVICE_CATEGORIES:
        cat = fleet.get(key) or {}
        count = int(cat.get("count") or 0)
        anomalies = cat.get("anomalies") or {}
        for i in range(count):
            device_id = f"{prefix}-{i:03d}"
            items.append({
                "device_id": device_id,
                "category": category,
                "zone": _ZONES[i % len(_ZONES)],
                "status": "alert" if device_id in anomalies else "ok",
                "anomaly_type": anomalies.get(device_id),
            })

    inc_map = await fetch_open_incidents_by_asset([d["device_id"] for d in items])
    for d in items:
        ids = inc_map.get(d["device_id"], [])
        d["open_incident_ids"] = ids
        d["open_incident_count"] = len(ids)
        # An open incident with no live anomaly => warning (recovering / acknowledged).
        if ids and d["status"] == "ok":
            d["status"] = "warning"

    summary = {
        "healthy": sum(1 for d in items if d["status"] == "ok"),
        "warning": sum(1 for d in items if d["status"] == "warning"),
        "alert": sum(1 for d in items if d["status"] == "alert"),
    }
    counts = {key: int((fleet.get(key) or {}).get("count") or 0) for key, _, _ in _DEVICE_CATEGORIES}
    return {"items": items, "counts": counts, "summary": summary, "total": len(items)}


# ---------------------------------------------------------------------------
# Fault injection
# ---------------------------------------------------------------------------

class FaultRequest(BaseModel):
    # Field names follow the platform fault convention (<name>_enabled), matching
    # analytics-service / ai-service and what demo-control-api + the dashboard send.
    memory_pressure_enabled: Optional[bool] = None


@app.post("/admin/fault")
async def inject_fault(req: FaultRequest):
    """
    Toggle fault injection flags at runtime.

    Examples:
      {"memory_pressure_enabled": true}   → allocate large in-memory buffers
      {"memory_pressure_enabled": false}  → reset
    """
    if req.memory_pressure_enabled is not None:
        fault_state.memory_pressure_enabled = req.memory_pressure_enabled
        if req.memory_pressure_enabled:
            fault_state.apply_memory_pressure()
        else:
            fault_state.release_memory_pressure()

    return {
        "ok": True,
        "faults": {
            "memory_pressure_enabled": fault_state.memory_pressure_enabled,
        },
    }

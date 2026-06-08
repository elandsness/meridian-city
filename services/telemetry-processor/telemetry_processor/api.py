"""
FastAPI routes for the telemetry-processor.

Endpoints:
  GET  /health            — liveness / readiness check
  GET  /api/v1/status     — Kafka consumer lag + aggregator state
  POST /admin/fault       — runtime fault injection
"""
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional

from .fault import fault_state

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
        "kafka_paused": fault_state.kafka_pause_enabled,
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
# Fault injection
# ---------------------------------------------------------------------------

class FaultRequest(BaseModel):
    kafka_pause: Optional[bool] = None
    memory_pressure: Optional[bool] = None


@app.post("/admin/fault")
async def inject_fault(req: FaultRequest):
    """
    Toggle fault injection flags at runtime.

    Examples:
      {"kafka_pause": true}         → pause Kafka consumption (simulates lag)
      {"memory_pressure": true}     → allocate large in-memory buffers
      {"kafka_pause": false, "memory_pressure": false}  → reset all
    """
    if req.kafka_pause is not None:
        fault_state.kafka_pause_enabled = req.kafka_pause

    if req.memory_pressure is not None:
        fault_state.memory_pressure_enabled = req.memory_pressure
        if req.memory_pressure:
            fault_state.apply_memory_pressure()
        else:
            fault_state.release_memory_pressure()

    return {
        "ok": True,
        "faults": {
            "kafka_pause": fault_state.kafka_pause_enabled,
            "memory_pressure": fault_state.memory_pressure_enabled,
        },
    }

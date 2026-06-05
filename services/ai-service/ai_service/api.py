"""
FastAPI route definitions for ai-service.

Endpoints:
  GET  /health                          — liveness check
  GET  /api/v1/status                   — runtime status + fault state
  POST /api/v1/chat                     — citizen chatbot message → LLM response
  GET  /api/v1/chat/history/{session_id}— conversation history for a session
  DELETE /api/v1/chat/history/{session_id} — clear a session's history
  POST /admin/fault                     — runtime fault injection
"""
from __future__ import annotations

import os
from typing import List, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from .fault import fault_state

app = FastAPI(title="Meridian City AI Service", version="1.0.0")

# Injected by main.py after startup
_chat_service = None


def set_chat_service(svc) -> None:
    global _chat_service
    _chat_service = svc


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    session_id: str = Field(default="default", max_length=128)
    # Optional: if provided, used to fetch context from citizen-service
    request_id: Optional[str] = Field(default=None, pattern=r"^req-\d+$")


class ChatResponse(BaseModel):
    response: str
    model: str
    input_tokens: int
    output_tokens: int
    provider: str


class HistoryMessage(BaseModel):
    role: str
    content: str


class FaultRequest(BaseModel):
    llm_latency_enabled: Optional[bool] = None
    llm_latency_seconds: Optional[float] = Field(default=None, ge=0, le=300)


class FaultResponse(BaseModel):
    llm_latency_enabled: bool
    llm_latency_seconds: float


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "ai-service",
        "provider": os.getenv("LLM_PROVIDER", "openai"),
        "model": os.getenv("LLM_MODEL", "gpt-4o"),
        "llm_latency_injected": fault_state.llm_latency_enabled,
    }


@app.get("/api/v1/status")
async def status():
    active_sessions = _chat_service.active_session_count() if _chat_service else 0
    return {
        "service": "ai-service",
        "provider": os.getenv("LLM_PROVIDER", "openai"),
        "model": os.getenv("LLM_MODEL", "gpt-4o"),
        "active_sessions": active_sessions,
        "fault": {
            "llm_latency_enabled": fault_state.llm_latency_enabled,
            "llm_latency_seconds": fault_state.llm_latency_seconds,
        },
    }


@app.post("/api/v1/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    if _chat_service is None:
        raise HTTPException(status_code=503, detail="chat service not initialised")

    try:
        result = await _chat_service.chat(
            message=request.message,
            session_id=request.session_id,
            request_id=request.request_id,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail="LLM request failed") from exc

    return ChatResponse(
        response=result.content,
        model=result.model,
        input_tokens=result.input_tokens,
        output_tokens=result.output_tokens,
        provider=result.gen_ai_system,
    )


@app.get("/api/v1/chat/history/{session_id}", response_model=List[HistoryMessage])
async def get_history(session_id: str):
    if _chat_service is None:
        raise HTTPException(status_code=503, detail="chat service not initialised")
    return _chat_service.get_history(session_id)


@app.delete("/api/v1/chat/history/{session_id}", status_code=204)
async def clear_history(session_id: str):
    if _chat_service is None:
        raise HTTPException(status_code=503, detail="chat service not initialised")
    _chat_service.clear_session(session_id)


@app.post("/admin/fault", response_model=FaultResponse)
async def inject_fault(request: FaultRequest):
    if request.llm_latency_enabled is not None:
        fault_state.llm_latency_enabled = request.llm_latency_enabled
        # When enabling without an explicit seconds value, default to 10s
        if request.llm_latency_enabled and fault_state.llm_latency_seconds == 0:
            fault_state.llm_latency_seconds = 10.0

    if request.llm_latency_seconds is not None:
        fault_state.llm_latency_seconds = request.llm_latency_seconds

    return FaultResponse(
        llm_latency_enabled=fault_state.llm_latency_enabled,
        llm_latency_seconds=fault_state.llm_latency_seconds,
    )

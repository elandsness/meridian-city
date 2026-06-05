"""
Entry point for ai-service.

Startup sequence:
  1. Configure JSON-structured logging (python-json-logger)
  2. Initialise OTel SDK (non-fatal if collector unreachable)
  3. Instrument FastAPI with OTel (request spans)
  4. Read initial fault injection config from env vars
  5. Instantiate the LLM provider (driven by LLM_PROVIDER env var)
  6. Wire up ChatService → FastAPI app

Shutdown:
  1. Close the httpx client in ChatService
"""
from __future__ import annotations

import logging
import os
import sys

import uvicorn
from pythonjsonlogger import jsonlogger

from .api import app, set_chat_service
from .chat import ChatService
from .fault import fault_state
from .otel import init_otel

logger = logging.getLogger(__name__)


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

    # "BusinessEvents" logger — dedicated name for Dynatrace log processing rules.
    # It inherits the root handler so no extra setup is required.
    logging.getLogger("BusinessEvents").propagate = True


# ---------------------------------------------------------------------------
# LLM provider factory
# ---------------------------------------------------------------------------

def _make_provider():
    provider_name = os.getenv("LLM_PROVIDER", "openai").lower()
    if provider_name == "anthropic":
        from .llm.anthropic_provider import AnthropicProvider
        return AnthropicProvider()
    elif provider_name == "local":
        from .llm.local_provider import LocalProvider
        return LocalProvider()
    else:
        # Default to OpenAI
        from .llm.openai_provider import OpenAIProvider
        return OpenAIProvider()


# ---------------------------------------------------------------------------
# FastAPI lifecycle hooks
# ---------------------------------------------------------------------------

_chat_service: ChatService | None = None


@app.on_event("startup")
async def startup() -> None:
    global _chat_service

    configure_logging()

    # OTel — non-fatal if the collector is not yet reachable
    try:
        init_otel()
    except Exception as exc:
        logger.warning("OTel init failed — observability disabled: %s", exc)

    # FastAPI auto-instrumentation (HTTP request spans)
    try:
        from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
        FastAPIInstrumentor.instrument_app(app)
        logger.info("FastAPI OTel instrumentation applied")
    except Exception as exc:
        logger.warning("FastAPI OTel instrumentation failed: %s", exc)

    # Fault injection — seed from env vars (overridable at runtime via /admin/fault)
    fault_state.llm_latency_enabled = (
        os.getenv("FAULT_LLM_LATENCY_ENABLED", "false").lower() == "true"
    )
    fault_state.llm_latency_seconds = float(
        os.getenv("FAULT_LLM_LATENCY_SECONDS", "0")
    )

    # LLM provider + chat service
    provider = _make_provider()
    _chat_service = ChatService(provider)
    set_chat_service(_chat_service)

    logger.info(
        "ai-service started",
        extra={
            "llm_provider": os.getenv("LLM_PROVIDER", "openai"),
            "llm_model": os.getenv("LLM_MODEL", "gpt-4o"),
            "llm_latency_enabled": fault_state.llm_latency_enabled,
        },
    )


@app.on_event("shutdown")
async def shutdown() -> None:
    logger.info("ai-service shutting down")
    if _chat_service is not None:
        await _chat_service.close()
    logger.info("shutdown complete")


# ---------------------------------------------------------------------------
# Standalone entrypoint
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8085"))
    uvicorn.run(
        "ai_service.main:app",
        host="0.0.0.0",
        port=port,
        log_config=None,  # JSON logging is configured above
    )

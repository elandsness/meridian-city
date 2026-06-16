"""
OpenTelemetry / OpenLLMetry initialisation for ai-service.

Uses the Traceloop SDK (OpenLLMetry), which:
  - configures the OTel TracerProvider + an OTLP/HTTP exporter pointed at the
    collector (OTEL_EXPORTER_OTLP_ENDPOINT, injected by Helm), and
  - auto-instruments the OpenAI / Anthropic clients so every LLM call emits a
    span carrying the GenAI semantic-convention attributes (gen_ai.request.model,
    gen_ai.usage.*, gen_ai.response.finish_reason, …) with no manual code.

chat.py keeps a thin parent span that carries the non-GenAI correlation key
(session.id) and sets Traceloop association properties so the auto-spans inherit
it. FastAPI request spans are added via FastAPIInstrumentor in main.py and use the
same tracer provider configured here.
"""
from __future__ import annotations

import logging
import os

from opentelemetry import trace

logger = logging.getLogger(__name__)

# Module-level tracer — resolves to a noop tracer until init_otel() is called.
_tracer: trace.Tracer = trace.get_tracer("ai-service")


def init_otel() -> None:
    """
    Initialise OpenLLMetry (Traceloop). Non-fatal: if the collector is
    unreachable at startup the service still starts and the exporter reconnects.
    When no OTLP endpoint is configured (e.g. local dev) tracing is left disabled
    rather than falling back to Traceloop's hosted endpoint.
    """
    global _tracer

    service_name = os.getenv("OTEL_SERVICE_NAME", "ai-service")
    endpoint = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT")

    if not endpoint:
        logger.info("OTEL_EXPORTER_OTLP_ENDPOINT unset — AI tracing disabled (dev mode)")
        _tracer = trace.get_tracer("ai-service")
        return

    try:
        from traceloop.sdk import Traceloop

        # api_endpoint is the OTLP/HTTP base; Traceloop appends /v1/traces.
        # telemetry_enabled=False stops the SDK from phoning home with usage stats.
        Traceloop.init(
            app_name=service_name,
            api_endpoint=endpoint,
            disable_batch=False,
            telemetry_enabled=False,
        )
        logger.info("OpenLLMetry (Traceloop) initialised — exporting to %s", endpoint)
    except Exception as exc:
        logger.warning("OpenLLMetry init failed — AI tracing disabled: %s", exc)

    _tracer = trace.get_tracer("ai-service")


def get_tracer() -> trace.Tracer:
    """Return the module-level tracer (noop until init_otel() is called)."""
    return _tracer

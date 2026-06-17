"""
OpenTelemetry tracing setup for analytics-service.

Why this exists: the cluster's DynaKube runs OneAgent in *applicationMonitoring*
mode (CSI code module, no host agent). That mode auto-instruments Java and Node
services into PurePaths, but does NOT produce traces for these Python/FastAPI apps
— so analytics-service was reporting no spans and no service entity at all. The fix
is the same pattern ai-service and iot-ingestion already use: the service
instruments itself with OpenTelemetry and exports OTLP to the in-cluster collector,
which forwards to Dynatrace.

Unlike ai-service (which uses Traceloop/OpenLLMetry for GenAI spans), this uses the
plain OpenTelemetry SDK: a TracerProvider + OTLP/HTTP span exporter pointed at
OTEL_EXPORTER_OTLP_ENDPOINT (injected by Helm's commonEnv), plus auto-instrumentation
for FastAPI and asyncpg.

Non-fatal by design: if OTel libs are missing or the collector is unreachable the
service still starts. When no OTLP endpoint is configured (local dev) tracing is
left disabled rather than defaulting to localhost.
"""
from __future__ import annotations

import logging
import os

logger = logging.getLogger(__name__)


def init_otel(app=None) -> None:
    """Configure the global tracer provider + OTLP exporter and instrument the app."""
    endpoint = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
    if not endpoint:
        logger.info("OTEL_EXPORTER_OTLP_ENDPOINT unset — tracing disabled (dev mode)")
        return

    try:
        from opentelemetry import trace
        from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
        from opentelemetry.sdk.resources import Resource
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor

        service_name = os.getenv("OTEL_SERVICE_NAME", "analytics-service")
        # Resource.create() merges OTEL_SERVICE_NAME + OTEL_RESOURCE_ATTRIBUTES
        # (deployment.environment, k8s.cluster.name) from the env via the default
        # resource detector, so spans land scoped to the meridian cluster.
        resource = Resource.create({"service.name": service_name})

        provider = TracerProvider(resource=resource)
        # OTLPSpanExporter() reads OTEL_EXPORTER_OTLP_ENDPOINT and appends /v1/traces.
        provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter()))
        trace.set_tracer_provider(provider)
        logger.info("OpenTelemetry tracing initialised — exporting to %s", endpoint)
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning("OTel init failed — tracing disabled: %s", exc)
        return

    # FastAPI request spans
    if app is not None:
        try:
            from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

            FastAPIInstrumentor.instrument_app(app)
            logger.info("FastAPI OTel instrumentation applied")
        except Exception as exc:  # pragma: no cover - defensive
            logger.warning("FastAPI OTel instrumentation failed: %s", exc)

    # asyncpg query spans (DB calls are the bulk of analytics-service's work)
    try:
        from opentelemetry.instrumentation.asyncpg import AsyncPGInstrumentor

        AsyncPGInstrumentor().instrument()
        logger.info("asyncpg OTel instrumentation applied")
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning("asyncpg OTel instrumentation failed: %s", exc)

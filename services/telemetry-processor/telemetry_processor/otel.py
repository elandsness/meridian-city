"""
OpenTelemetry tracing setup for telemetry-processor.

Why this exists: the cluster's DynaKube runs OneAgent in *applicationMonitoring*
mode (CSI code module, no host agent). That mode auto-instruments Java and Node
services into PurePaths, but does NOT produce traces for these Python apps — so
telemetry-processor was reporting no spans and no service entity at all. The fix is
the same pattern ai-service and iot-ingestion already use: the service instruments
itself with OpenTelemetry and exports OTLP to the in-cluster collector, which
forwards to Dynatrace.

This uses the plain OpenTelemetry SDK: a TracerProvider + OTLP/HTTP span exporter
pointed at OTEL_EXPORTER_OTLP_ENDPOINT (injected by Helm's commonEnv), plus
auto-instrumentation for FastAPI, asyncpg, httpx, and aiokafka. The aiokafka
instrumentation is the important one here — consuming IoT telemetry off Kafka is
this service's main workload, so it's what should show up in the service flow.

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

        service_name = os.getenv("OTEL_SERVICE_NAME", "telemetry-processor")
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

    # FastAPI request spans (health/admin endpoints)
    if app is not None:
        try:
            from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

            FastAPIInstrumentor.instrument_app(app)
            logger.info("FastAPI OTel instrumentation applied")
        except Exception as exc:  # pragma: no cover - defensive
            logger.warning("FastAPI OTel instrumentation failed: %s", exc)

    # Each instrumentor is independent and non-fatal: aiokafka (Kafka consume — the
    # main workload), asyncpg (DB writes), httpx (calls to iot-simulator).
    for name, factory in (
        ("aiokafka", _aiokafka_instrumentor),
        ("asyncpg", _asyncpg_instrumentor),
        ("httpx", _httpx_instrumentor),
    ):
        try:
            factory()
            logger.info("%s OTel instrumentation applied", name)
        except Exception as exc:  # pragma: no cover - defensive
            logger.warning("%s OTel instrumentation failed: %s", name, exc)


def _aiokafka_instrumentor() -> None:
    from opentelemetry.instrumentation.aiokafka import AIOKafkaInstrumentor

    AIOKafkaInstrumentor().instrument()


def _asyncpg_instrumentor() -> None:
    from opentelemetry.instrumentation.asyncpg import AsyncPGInstrumentor

    AsyncPGInstrumentor().instrument()


def _httpx_instrumentor() -> None:
    from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor

    HTTPXClientInstrumentor().instrument()

"""
OpenTelemetry SDK initialisation for ai-service.

Uses OTLP/HTTP exporter — endpoint is injected by Helm as:
  OTEL_EXPORTER_OTLP_ENDPOINT=http://<release>-opentelemetry-collector:4318

The Python OTLP HTTP exporter reads that env var automatically and appends
the signal-specific path (/v1/traces, /v1/metrics), so no manual URL
construction is required here.

GenAI semantic convention attributes are applied manually in chat.py, not here.
FastAPI request spans are added via FastAPIInstrumentor in main.py.
"""
from __future__ import annotations

import logging
import os

from opentelemetry import metrics, trace
from opentelemetry.exporter.otlp.proto.http.metric_exporter import OTLPMetricExporter
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.sdk.resources import SERVICE_NAME, Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

logger = logging.getLogger(__name__)

# Module-level tracer — resolves to a noop tracer until init_otel() is called.
_tracer: trace.Tracer = trace.get_tracer("ai-service")


def init_otel() -> None:
    """
    Initialise the SDK TracerProvider and MeterProvider.
    Non-fatal: if the OTel Collector is unreachable at startup the service
    still starts; reconnection is handled automatically by the exporter.
    """
    global _tracer

    service_name = os.getenv("OTEL_SERVICE_NAME", "ai-service")
    resource = Resource.create({SERVICE_NAME: service_name})

    # --- Traces -----------------------------------------------------------
    try:
        # OTLPSpanExporter reads OTEL_EXPORTER_OTLP_ENDPOINT from the environment
        # and appends /v1/traces automatically.
        span_exporter = OTLPSpanExporter()
        tracer_provider = TracerProvider(resource=resource)
        tracer_provider.add_span_processor(BatchSpanProcessor(span_exporter))
        trace.set_tracer_provider(tracer_provider)
        logger.info("OTel trace provider initialised")
    except Exception as exc:
        logger.warning("OTel trace exporter init failed — tracing disabled: %s", exc)

    # --- Metrics ----------------------------------------------------------
    try:
        # OTLPMetricExporter similarly reads the env var and appends /v1/metrics.
        metric_exporter = OTLPMetricExporter()
        reader = PeriodicExportingMetricReader(
            metric_exporter, export_interval_millis=60_000
        )
        meter_provider = MeterProvider(resource=resource, metric_readers=[reader])
        metrics.set_meter_provider(meter_provider)
        logger.info("OTel metrics provider initialised")
    except Exception as exc:
        logger.warning("OTel metrics exporter init failed — metrics disabled: %s", exc)

    _tracer = trace.get_tracer("ai-service")


def get_tracer() -> trace.Tracer:
    """Return the module-level tracer (noop until init_otel() is called)."""
    return _tracer

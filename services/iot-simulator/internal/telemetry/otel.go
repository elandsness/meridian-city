package telemetry

import (
	"context"
	"fmt"
	"log"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetricgrpc"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	"go.opentelemetry.io/otel/sdk/metric"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
)

// InitOTel initializes the OpenTelemetry SDK with OTLP gRPC exporters.
//
//   - ingestionEndpoint (e.g. "iot-ingestion:4317") receives device METRICS so
//     iot-ingestion can enrich them and publish to Kafka.
//   - collectorEndpoint (e.g. "<release>-opentelemetry-collector:4317"), when
//     non-empty, additionally receives device metrics AND traces so they reach
//     Dynatrace via the OTel Collector. iot-ingestion only acknowledges (drops)
//     traces, so traces must go to the collector to be observable.
//
// Endpoints are host:port (no scheme) for gRPC. If an endpoint is unreachable at
// startup the SDK retries in the background. Returns a shutdown function that
// flushes and closes all providers.
func InitOTel(ctx context.Context, ingestionEndpoint, collectorEndpoint string) (func(context.Context) error, error) {
	// Defaults first, then WithFromEnv so OTEL_SERVICE_NAME / OTEL_RESOURCE_ATTRIBUTES
	// (set by Helm: deployment.environment, k8s.cluster.name) override/augment them.
	res, err := resource.New(ctx,
		resource.WithAttributes(
			attribute.String("service.name", "iot-simulator"),
			attribute.String("service.version", "1.0.0"),
		),
		resource.WithFromEnv(),
	)
	if err != nil {
		return nil, fmt.Errorf("create resource: %w", err)
	}

	// --- Metric exporters ---------------------------------------------------
	// Always export metrics to iot-ingestion (Kafka enrichment path).
	var metricReaders []metric.Option

	if exp := newMetricExporter(ctx, ingestionEndpoint); exp != nil {
		metricReaders = append(metricReaders, metric.WithReader(metric.NewPeriodicReader(exp)))
	}
	// Also export metrics directly to the collector (Dynatrace path) when configured.
	if collectorEndpoint != "" {
		if exp := newMetricExporter(ctx, collectorEndpoint); exp != nil {
			metricReaders = append(metricReaders, metric.WithReader(metric.NewPeriodicReader(exp)))
		}
	}

	mpOpts := append([]metric.Option{metric.WithResource(res)}, metricReaders...)
	mp := metric.NewMeterProvider(mpOpts...)
	otel.SetMeterProvider(mp)

	// --- Trace exporter -----------------------------------------------------
	// Traces must reach the collector to be observable; fall back to the
	// ingestion endpoint only if no collector is configured.
	traceEndpoint := collectorEndpoint
	if traceEndpoint == "" {
		traceEndpoint = ingestionEndpoint
	}

	var tp *sdktrace.TracerProvider
	if traceExp := newTraceExporter(ctx, traceEndpoint); traceExp != nil {
		tp = sdktrace.NewTracerProvider(
			sdktrace.WithBatcher(traceExp),
			sdktrace.WithResource(res),
		)
	} else {
		tp = sdktrace.NewTracerProvider(sdktrace.WithResource(res))
	}
	otel.SetTracerProvider(tp)

	log.Printf("OTel initialised (metrics→%s%s, traces→%s)",
		ingestionEndpoint,
		func() string {
			if collectorEndpoint != "" {
				return " + " + collectorEndpoint
			}
			return ""
		}(),
		traceEndpoint,
	)

	shutdown := func(ctx context.Context) error {
		var firstErr error
		if err := tp.Shutdown(ctx); err != nil {
			firstErr = err
			log.Printf("WARNING: trace provider shutdown error: %v", err)
		}
		if err := mp.Shutdown(ctx); err != nil {
			if firstErr == nil {
				firstErr = err
			}
			log.Printf("WARNING: meter provider shutdown error: %v", err)
		}
		return firstErr
	}

	return shutdown, nil
}

// newMetricExporter creates an OTLP/gRPC metric exporter, logging and returning
// nil (rather than failing) if it cannot be created.
func newMetricExporter(ctx context.Context, endpoint string) *otlpmetricgrpc.Exporter {
	exp, err := otlpmetricgrpc.New(ctx,
		otlpmetricgrpc.WithEndpoint(endpoint),
		otlpmetricgrpc.WithInsecure(),
	)
	if err != nil {
		log.Printf("WARNING: could not create metric exporter (endpoint=%s): %v", endpoint, err)
		return nil
	}
	return exp
}

// newTraceExporter creates an OTLP/gRPC trace exporter, logging and returning
// nil (rather than failing) if it cannot be created.
func newTraceExporter(ctx context.Context, endpoint string) *otlptracegrpc.Exporter {
	exp, err := otlptracegrpc.New(ctx,
		otlptracegrpc.WithEndpoint(endpoint),
		otlptracegrpc.WithInsecure(),
	)
	if err != nil {
		log.Printf("WARNING: could not create trace exporter (endpoint=%s): %v", endpoint, err)
		return nil
	}
	return exp
}

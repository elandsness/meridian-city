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
// If the endpoint is unreachable at startup, the SDK will retry in the background.
// Returns a shutdown function that flushes and closes all providers.
func InitOTel(ctx context.Context, endpoint string) (func(context.Context) error, error) {
	res, err := resource.New(ctx,
		resource.WithAttributes(
			attribute.String("service.name", "iot-simulator"),
			attribute.String("service.version", "1.0.0"),
		),
	)
	if err != nil {
		return nil, fmt.Errorf("create resource: %w", err)
	}

	// Trace exporter — non-blocking; SDK handles retries/reconnection
	traceExp, err := otlptracegrpc.New(ctx,
		otlptracegrpc.WithEndpoint(endpoint),
		otlptracegrpc.WithInsecure(),
	)
	if err != nil {
		log.Printf("WARNING: could not create trace exporter (endpoint=%s): %v — continuing without traces", endpoint, err)
	}

	// Metric exporter — non-blocking
	metricExp, err := otlpmetricgrpc.New(ctx,
		otlpmetricgrpc.WithEndpoint(endpoint),
		otlpmetricgrpc.WithInsecure(),
	)
	if err != nil {
		log.Printf("WARNING: could not create metric exporter (endpoint=%s): %v — continuing without metrics", endpoint, err)
	}

	// Trace provider
	var tp *sdktrace.TracerProvider
	if traceExp != nil {
		tp = sdktrace.NewTracerProvider(
			sdktrace.WithBatcher(traceExp),
			sdktrace.WithResource(res),
		)
	} else {
		tp = sdktrace.NewTracerProvider(sdktrace.WithResource(res))
	}
	otel.SetTracerProvider(tp)

	// Metric provider
	var mp *metric.MeterProvider
	if metricExp != nil {
		mp = metric.NewMeterProvider(
			metric.WithReader(metric.NewPeriodicReader(metricExp)),
			metric.WithResource(res),
		)
	} else {
		mp = metric.NewMeterProvider(metric.WithResource(res))
	}
	otel.SetMeterProvider(mp)

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

package telemetry

import (
	"context"
	"fmt"
	"log"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/otlp/otlplog/otlploggrpc"
	"go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetricgrpc"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	logapi "go.opentelemetry.io/otel/log"
	logglobal "go.opentelemetry.io/otel/log/global"
	sdklog "go.opentelemetry.io/otel/sdk/log"
	"go.opentelemetry.io/otel/sdk/metric"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
)

// InitOTel initializes the OpenTelemetry SDK (traces, metrics, and logs) with
// OTLP gRPC exporters. If the endpoint is unreachable at startup, the SDK
// retries in the background rather than failing the process. Returns a
// shutdown function that flushes and closes all providers.
func InitOTel(ctx context.Context, endpoint string) (func(context.Context) error, error) {
	res, err := resource.New(ctx,
		// WithFromEnv picks up OTEL_RESOURCE_ATTRIBUTES (deployment.environment,
		// k8s.cluster.name, service.namespace) -- the per-instance identity
		// attributes that distinguish this instance's telemetry on the shared
		// Dynatrace tenant (see helm/templates/iot-simulator.yaml).
		resource.WithFromEnv(),
		resource.WithAttributes(
			attribute.String("service.name", "iot-simulator"),
			attribute.String("service.version", "1.0.0"),
		),
	)
	if err != nil {
		return nil, fmt.Errorf("create resource: %w", err)
	}

	traceExp, err := otlptracegrpc.New(ctx,
		otlptracegrpc.WithEndpoint(endpoint),
		otlptracegrpc.WithInsecure(),
	)
	if err != nil {
		log.Printf("WARNING: could not create trace exporter (endpoint=%s): %v — continuing without traces", endpoint, err)
	}

	metricExp, err := otlpmetricgrpc.New(ctx,
		otlpmetricgrpc.WithEndpoint(endpoint),
		otlpmetricgrpc.WithInsecure(),
	)
	if err != nil {
		log.Printf("WARNING: could not create metric exporter (endpoint=%s): %v — continuing without metrics", endpoint, err)
	}

	logExp, err := otlploggrpc.New(ctx,
		otlploggrpc.WithEndpoint(endpoint),
		otlploggrpc.WithInsecure(),
	)
	if err != nil {
		log.Printf("WARNING: could not create log exporter (endpoint=%s): %v — continuing without logs", endpoint, err)
	}

	var tp *sdktrace.TracerProvider
	if traceExp != nil {
		tp = sdktrace.NewTracerProvider(sdktrace.WithBatcher(traceExp), sdktrace.WithResource(res))
	} else {
		tp = sdktrace.NewTracerProvider(sdktrace.WithResource(res))
	}
	otel.SetTracerProvider(tp)

	var mp *metric.MeterProvider
	if metricExp != nil {
		mp = metric.NewMeterProvider(metric.WithReader(metric.NewPeriodicReader(metricExp)), metric.WithResource(res))
	} else {
		mp = metric.NewMeterProvider(metric.WithResource(res))
	}
	otel.SetMeterProvider(mp)

	var lp *sdklog.LoggerProvider
	if logExp != nil {
		lp = sdklog.NewLoggerProvider(sdklog.WithProcessor(sdklog.NewBatchProcessor(logExp)), sdklog.WithResource(res))
	} else {
		lp = sdklog.NewLoggerProvider(sdklog.WithResource(res))
	}
	logglobal.SetLoggerProvider(lp)

	shutdown := func(ctx context.Context) error {
		var firstErr error
		record := func(err error, what string) {
			if err == nil {
				return
			}
			if firstErr == nil {
				firstErr = err
			}
			log.Printf("WARNING: %s shutdown error: %v", what, err)
		}
		record(tp.Shutdown(ctx), "trace provider")
		record(mp.Shutdown(ctx), "meter provider")
		record(lp.Shutdown(ctx), "logger provider")
		return firstErr
	}

	return shutdown, nil
}

// SeverityFromLevel maps a config-declared log level string to an OTel log
// severity number.
func SeverityFromLevel(level string) logapi.Severity {
	switch level {
	case "debug":
		return logapi.SeverityDebug
	case "warn":
		return logapi.SeverityWarn
	case "error":
		return logapi.SeverityError
	default:
		return logapi.SeverityInfo
	}
}

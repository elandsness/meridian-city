package telemetry

import (
	"context"
	"log"
	"os"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.26.0"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

// Tracer is the package-level tracer, set after Init is called.
var Tracer trace.Tracer

// Init sets up OTel self-instrumentation, exporting spans to the OTel Collector.
// Returns a shutdown function that should be called on exit.
// If the endpoint is unreachable, logs a warning and continues — does not fatal.
func Init(ctx context.Context) (func(context.Context) error, error) {
	endpoint := os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
	if endpoint == "" {
		endpoint = "otel-collector:4317"
	}

	// Use non-blocking dial so startup doesn't hang if collector is unreachable.
	conn, err := grpc.NewClient(
		endpoint,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	)
	if err != nil {
		log.Printf("[telemetry] warning: could not create gRPC connection to %s: %v — self-instrumentation disabled", endpoint, err)
		Tracer = otel.Tracer("iot-ingestion")
		return func(context.Context) error { return nil }, nil
	}

	exporter, err := otlptracegrpc.New(ctx, otlptracegrpc.WithGRPCConn(conn))
	if err != nil {
		log.Printf("[telemetry] warning: could not create OTLP trace exporter: %v — self-instrumentation disabled", err)
		Tracer = otel.Tracer("iot-ingestion")
		return func(context.Context) error { return nil }, nil
	}

	res, err := resource.New(ctx,
		resource.WithAttributes(
			semconv.ServiceName("iot-ingestion"),
			semconv.ServiceVersion("1.0.0"),
		),
	)
	if err != nil {
		log.Printf("[telemetry] warning: could not create resource: %v", err)
		res = resource.Default()
	}

	tp := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exporter),
		sdktrace.WithResource(res),
	)

	otel.SetTracerProvider(tp)
	Tracer = otel.Tracer("iot-ingestion")

	log.Printf("[telemetry] OTel self-instrumentation configured, exporting to %s", endpoint)

	return tp.Shutdown, nil
}

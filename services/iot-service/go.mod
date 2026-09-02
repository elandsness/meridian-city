module github.com/meridian/iot-service

go 1.22

require (
	github.com/confluentinc/confluent-kafka-go/v2 v2.5.1
	github.com/google/uuid v1.6.0
	github.com/prometheus/client_golang v1.20.5
	go.opentelemetry.io/otel v1.32.0
	go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetricgrpc v1.32.0
	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.32.0
	go.opentelemetry.io/otel/metric v1.32.0
	go.opentelemetry.io/otel/sdk v1.32.0
	go.opentelemetry.io/otel/sdk/metric v1.32.0
	go.opentelemetry.io/otel/trace v1.32.0
	google.golang.org/grpc v1.65.0
	google.golang.org/protobuf v1.36.1
)

module github.com/meridian/iot-ingestion

go 1.22

require (
	go.opentelemetry.io/otel v1.28.0
	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.28.0
	go.opentelemetry.io/otel/sdk v1.28.0
	go.opentelemetry.io/otel/trace v1.28.0
	go.opentelemetry.io/proto/otlp v1.3.1
	github.com/segmentio/kafka-go v0.4.47
	github.com/lib/pq v1.10.9
	google.golang.org/grpc v1.65.0
	google.golang.org/protobuf v1.34.2
)

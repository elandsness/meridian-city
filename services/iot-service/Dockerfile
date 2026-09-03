# Build stage
FROM golang:1.26-alpine AS builder

# confluent-kafka-go/v2 is a cgo binding. Its default bundled librdkafka
# static archive is built against glibc (undefined setcontext/getcontext/
# fopen64 when linked on musl) -- Alpine needs the `dynamic` build tag to
# link against a system librdkafka via pkg-config instead.
RUN apk add --no-cache gcc musl-dev pkgconfig librdkafka-dev

WORKDIR /app

# Cache dependencies
COPY go.mod go.sum ./
RUN go mod download

# Copy source
COPY . .

# Build
RUN CGO_ENABLED=1 GOOS=linux go build -tags dynamic -ldflags="-s -w" -o iot-service ./cmd/iot-service

# Runtime stage -- must match the builder's Alpine release (golang:1.26-alpine
# is Alpine 3.24) so the runtime librdkafka package is new enough for the
# client: confluent-kafka-go v2.5.4 requires librdkafka >= v2.5.3, which
# Alpine 3.20's repo doesn't have (only 2.4.0).
FROM alpine:3.24

RUN apk --no-cache add ca-certificates tzdata librdkafka

WORKDIR /app

COPY --from=builder /app/iot-service .

# OTLP gRPC: 4317, OTLP HTTP: 4318, REST API: 8086
EXPOSE 4317 4318 8086

ENTRYPOINT ["./iot-service"]

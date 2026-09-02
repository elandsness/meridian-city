# Build stage
FROM golang:1.22-alpine AS builder

WORKDIR /app

# Cache dependencies
COPY go.mod go.sum ./
RUN go mod download

# Copy source
COPY . .

# Build
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o iot-service ./cmd/iot-service

# Runtime stage
FROM alpine:3.20

RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app

COPY --from=builder /app/iot-service .

# OTLP gRPC: 4317, OTLP HTTP: 4318, REST API: 8086
EXPOSE 4317 4318 8086

ENTRYPOINT ["./iot-service"]

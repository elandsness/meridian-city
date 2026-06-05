# Stage 1: Build
FROM golang:1.22-alpine AS builder

WORKDIR /app

COPY go.mod go.sum* ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /iot-ingestion ./cmd/iot-ingestion

# Stage 2: Runtime
FROM alpine:3.19

RUN apk add --no-cache ca-certificates

COPY --from=builder /iot-ingestion /iot-ingestion

EXPOSE 4317 8089

CMD ["/iot-ingestion"]

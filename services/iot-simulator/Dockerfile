# Stage 1: build
FROM golang:1.22-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -o /iot-simulator ./cmd/iot-simulator

# Stage 2: minimal runtime image
FROM alpine:3.19

RUN apk add --no-cache ca-certificates

COPY --from=builder /iot-simulator /iot-simulator

EXPOSE 8088

CMD ["/iot-simulator"]

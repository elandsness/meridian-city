# Stage 1: build
FROM golang:1.22-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -o /movement-service ./cmd/movement-service

# Stage 2: minimal runtime image
FROM alpine:3.19

RUN apk add --no-cache ca-certificates

COPY --from=builder /movement-service /movement-service

EXPOSE 8095

CMD ["/movement-service"]

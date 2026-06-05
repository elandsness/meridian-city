package main

import (
	"context"
	"log"
	"net"
	"os"
	"os/signal"
	"syscall"

	"google.golang.org/grpc"

	metricsv1 "go.opentelemetry.io/proto/otlp/collector/metrics/v1"
	tracesv1 "go.opentelemetry.io/proto/otlp/collector/trace/v1"

	"github.com/meridian/iot-ingestion/internal/health"
	"github.com/meridian/iot-ingestion/internal/publisher"
	"github.com/meridian/iot-ingestion/internal/receiver"
	"github.com/meridian/iot-ingestion/internal/telemetry"
	"github.com/meridian/iot-ingestion/internal/validator"
)

func getEnv(key, defaultValue string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultValue
}

func main() {
	// --- Configuration from environment ---
	otlpPort := getEnv("OTLP_GRPC_PORT", "4317")
	healthPort := getEnv("HEALTH_PORT", "8089")
	kafkaBrokers := getEnv("KAFKA_BOOTSTRAP_SERVERS", "kafka:9092")
	kafkaTopic := getEnv("KAFKA_TOPIC", "iot.telemetry.raw")
	dbHost := getEnv("DB_HOST", "postgresql")
	dbPort := getEnv("DB_PORT", "5432")
	dbName := getEnv("DB_NAME", "meridian")
	dbUser := getEnv("DB_USER", "meridian")
	dbPassword := getEnv("DB_PASSWORD", "meridian")

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// --- OTel self-instrumentation ---
	shutdown, err := telemetry.Init(ctx)
	if err != nil {
		log.Printf("[main] warning: OTel init error: %v", err)
	}
	defer func() {
		if err := shutdown(ctx); err != nil {
			log.Printf("[main] OTel shutdown error: %v", err)
		}
	}()

	// --- PostgreSQL / device validator ---
	db, err := validator.NewDB(dbHost, dbPort, dbUser, dbPassword, dbName)
	if err != nil {
		log.Printf("[main] warning: could not open DB: %v — validator will fail-open", err)
	}

	v := validator.NewValidator(db)
	v.Start(ctx)

	// --- Kafka publisher ---
	pub := publisher.NewPublisher(kafkaBrokers, kafkaTopic)
	defer func() {
		if err := pub.Close(); err != nil {
			log.Printf("[main] Kafka publisher close error: %v", err)
		}
	}()

	// --- Health HTTP server ---
	go health.StartHealthServer(healthPort)

	// --- OTLP gRPC server ---
	grpcServer := grpc.NewServer()
	metricsv1.RegisterMetricsServiceServer(grpcServer, receiver.NewMetricsReceiver(v, pub))
	tracesv1.RegisterTraceServiceServer(grpcServer, &receiver.TracesReceiver{})

	lis, err := net.Listen("tcp", ":"+otlpPort)
	if err != nil {
		log.Fatalf("[main] failed to listen on port %s: %v", otlpPort, err)
	}

	go func() {
		log.Printf("[main] OTLP gRPC server listening on :%s", otlpPort)
		if err := grpcServer.Serve(lis); err != nil {
			log.Printf("[main] gRPC server stopped: %v", err)
		}
	}()

	log.Printf("[main] iot-ingestion started (OTLP:%s, health:%s)", otlpPort, healthPort)

	// --- Block until OS signal ---
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("[main] shutting down...")
	cancel()
	grpcServer.GracefulStop()
	log.Println("[main] goodbye")
}

package main

import (
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/meridian/iot-service/internal/anomaly"
	"github.com/meridian/iot-service/internal/config"
	"github.com/meridian/iot-service/internal/fleet"
	"github.com/meridian/iot-service/internal/ingestion"
	"github.com/meridian/iot-service/internal/kafka"
	"github.com/meridian/iot-service/internal/telemetry"
)

func main() {
	cfg := config.Load()

	// Initialize services
	kafkaProducer, err := kafka.NewProducer(cfg.KafkaBootstrapServers)
	if err != nil {
		log.Fatalf("Failed to create Kafka producer: %v", err)
	}
	defer kafkaProducer.Close()

	deviceRegistry := telemetry.NewDeviceRegistry(cfg.DBHost, cfg.DBName, cfg.DBUsername, cfg.DBPassword)
	go deviceRegistry.Start()
	defer deviceRegistry.Stop()

	fleetManager := fleet.NewManager(cfg.SimulatorFleet)
	fleetManager.Start()
	defer fleetManager.Stop()

	anomalyDetector := anomaly.NewDetector(cfg.AnomalyThresholds)

	// Initialize OTLP receivers
	otlpGRPC := ingestion.NewOTLPGRPCReceiver(cfg.OTLPGRPCPort, kafkaProducer)
	otlpHTTP := ingestion.NewOTLPHTTPReceiver(cfg.OTLPHTTPPort, kafkaProducer)

	// Initialize REST API server
	apiServer := &http.Server{
		Addr:    ":" + cfg.RESTAPIPort,
		Handler: buildRouter(kafkaProducer, fleetManager, anomalyDetector),
	}

	// Start all services
	go func() {
		log.Printf("Starting OTLP gRPC receiver on :%s", cfg.OTLPGRPCPort)
		if err := otlpGRPC.Start(); err != nil {
			log.Printf("OTLP gRPC receiver error: %v", err)
		}
	}()

	go func() {
		log.Printf("Starting OTLP HTTP receiver on :%s", cfg.OTLPHTTPPort)
		if err := otlpHTTP.Start(); err != nil {
			log.Printf("OTLP HTTP receiver error: %v", err)
		}
	}()

	go func() {
		log.Printf("Starting REST API server on :%s", cfg.RESTAPIPort)
		if err := apiServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("REST API server error: %v", err)
		}
	}()

	// Wait for interrupt
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down IoT service...")

	// Graceful shutdown
	apiServer.Shutdown(nil)
	fleetManager.Stop()
	deviceRegistry.Stop()

	log.Println("IoT service stopped")
}

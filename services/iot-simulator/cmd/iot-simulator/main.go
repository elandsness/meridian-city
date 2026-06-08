package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/meridian/iot-simulator/internal/admin"
	"github.com/meridian/iot-simulator/internal/fleet"
	"github.com/meridian/iot-simulator/internal/telemetry"
)

func main() {
	otlpEndpoint    := envStr("OTLP_ENDPOINT", "iot-ingestion:4317")
	vehicleCount    := envInt("VEHICLE_COUNT", 30)
	buildingCount   := envInt("BUILDING_COUNT", 15)
	machineCount    := envInt("MACHINE_COUNT", 10)
	emitInterval    := envInt("EMIT_INTERVAL_SECONDS", 15)
	adminPort       := envStr("ADMIN_PORT", "8088")

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	// Initialise OTel — non-fatal if endpoint is unreachable at startup.
	shutdown, err := telemetry.InitOTel(ctx, otlpEndpoint)
	if err != nil {
		log.Printf("WARNING: OTel init error: %v — continuing without telemetry export", err)
		shutdown = func(context.Context) error { return nil }
	}
	defer func() {
		shutCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := shutdown(shutCtx); err != nil {
			log.Printf("WARNING: OTel shutdown: %v", err)
		}
	}()

	// Create and initialise the fleet manager.
	mgr := fleet.NewManager(emitInterval)
	mgr.Initialize(ctx, vehicleCount, buildingCount, machineCount)
	defer mgr.StopAll()

	// Start the admin HTTP server in a separate goroutine.
	adminSrv := admin.NewServer(mgr, adminPort)
	srvErr := make(chan error, 1)
	go func() {
		srvErr <- adminSrv.Start(ctx)
	}()

	log.Printf("iot-simulator started (vehicles=%d buildings=%d machines=%d interval=%ds endpoint=%s)",
		vehicleCount, buildingCount, machineCount, emitInterval, otlpEndpoint)

	select {
	case <-ctx.Done():
		log.Println("iot-simulator: shutting down (signal received)")
	case err := <-srvErr:
		if err != nil {
			log.Printf("iot-simulator: admin server error: %v", err)
		}
	}
}

func envStr(key, defaultVal string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultVal
}

func envInt(key string, defaultVal int) int {
	v := os.Getenv(key)
	if v == "" {
		return defaultVal
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		log.Printf("WARNING: invalid value for %s=%q, using default %d", key, v, defaultVal)
		return defaultVal
	}
	return n
}

package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/meridian/iot-simulator/internal/admin"
	"github.com/meridian/iot-simulator/internal/config"
	"github.com/meridian/iot-simulator/internal/faultgate"
	"github.com/meridian/iot-simulator/internal/fleet"
	"github.com/meridian/iot-simulator/internal/telemetry"
)

func main() {
	configPath := envStr("IOT_CONFIG_PATH", "/etc/meridian/iot-config.json")
	otlpEndpoint := envStr("OTLP_ENDPOINT", "otel-collector:4317")
	adminPort := envStr("ADMIN_PORT", "8088")

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	cfg, err := config.Load(configPath)
	if err != nil {
		log.Fatalf("iot-simulator: failed to load config %q: %v", configPath, err)
	}
	if !cfg.Enabled {
		log.Printf("iot-simulator: industry.iot.enabled is false (or config %q is absent) — no devices to simulate, serving /health only", configPath)
	}

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

	instruments, err := telemetry.NewInstruments(metricUnits(cfg))
	if err != nil {
		log.Fatalf("iot-simulator: failed to create OTel instruments: %v", err)
	}
	logEmitter := telemetry.NewLogEmitter()
	gates := faultgate.NewRegistry()

	mgr := fleet.NewManager(cfg, gates, instruments, logEmitter)
	mgr.Initialize(ctx)
	defer mgr.StopAll()

	adminSrv := admin.NewServer(mgr, gates, cfg, adminPort)
	srvErr := make(chan error, 1)
	go func() {
		srvErr <- adminSrv.Start(ctx)
	}()

	log.Printf("iot-simulator started (device_types=%d endpoint=%s config=%s)",
		len(cfg.DeviceTypes), otlpEndpoint, configPath)

	select {
	case <-ctx.Done():
		log.Println("iot-simulator: shutting down (signal received)")
	case err := <-srvErr:
		if err != nil {
			log.Printf("iot-simulator: admin server error: %v", err)
		}
	}
}

// metricUnits collects every unique metric name -> unit across all top-level
// and child device types, for one-time OTel instrument creation.
func metricUnits(cfg *config.Config) map[string]string {
	units := make(map[string]string)
	for _, dt := range cfg.DeviceTypes {
		for _, m := range dt.Metrics {
			units[m.Name] = m.Unit
		}
		for _, child := range dt.Children {
			for _, m := range child.Metrics {
				units[m.Name] = m.Unit
			}
		}
	}
	return units
}

func envStr(key, defaultVal string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultVal
}

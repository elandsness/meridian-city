package telemetry

import (
	"fmt"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/metric"
)

// Instruments holds all synchronous Float64Gauge instruments for IoT devices.
type Instruments struct {
	GaugeMap map[string]metric.Float64Gauge
}

// NewInstruments creates all metric instruments using the global MeterProvider.
func NewInstruments(metricConfigs map[string]string) (*Instruments, error) {
	m := otel.Meter("iot-simulator")

	gaugeMap := make(map[string]metric.Float64Gauge, len(metricConfigs))
	for name, unit := range metricConfigs {
		opts := []metric.Float64GaugeOption{
			metric.WithUnit(unit),
		}
		g, err := m.Float64Gauge(name, opts...)
		if err != nil {
			return nil, fmt.Errorf("create gauge %q: %w", name, err)
		}
		gaugeMap[name] = g
	}

	return &Instruments{GaugeMap: gaugeMap}, nil
}

package telemetry

import (
	"fmt"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/metric"
)

// Instruments holds one synchronous Float64Gauge per configured metric name,
// built once from the full set of metrics across every configured device
// type (and their children).
type Instruments struct {
	GaugeMap map[string]metric.Float64Gauge
}

// NewInstruments creates a gauge for every (name, unit) pair.
func NewInstruments(metricUnits map[string]string) (*Instruments, error) {
	m := otel.Meter("iot-simulator")

	gaugeMap := make(map[string]metric.Float64Gauge, len(metricUnits))
	for name, unit := range metricUnits {
		g, err := m.Float64Gauge(name, metric.WithUnit(unit))
		if err != nil {
			return nil, fmt.Errorf("create gauge %q: %w", name, err)
		}
		gaugeMap[name] = g
	}

	return &Instruments{GaugeMap: gaugeMap}, nil
}

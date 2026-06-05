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
func NewInstruments() (*Instruments, error) {
	m := otel.Meter("iot-simulator")

	gauges := map[string]struct {
		unit string
	}{
		// Vehicle
		"iot.vehicle.speed":       {unit: "km/h"},
		"iot.vehicle.engine_temp": {unit: "Cel"},
		"iot.vehicle.fuel_level":  {unit: "%"},
		"iot.vehicle.gps_lat":     {unit: ""},
		"iot.vehicle.gps_lon":     {unit: ""},

		// Building
		"iot.building.hvac_temp":    {unit: "Cel"},
		"iot.building.hvac_setpoint": {unit: "Cel"},
		"iot.building.energy_kwh":   {unit: "kWh"},
		"iot.building.occupancy":    {unit: "{person}"},
		"iot.building.co2_ppm":      {unit: "ppm"},

		// Machine
		"iot.machine.vibration":   {unit: "mm/s"},
		"iot.machine.cycle_count": {unit: ""},
		"iot.machine.temp":        {unit: "Cel"},
		"iot.machine.error_rate":  {unit: "%"},
		"iot.machine.throughput":  {unit: "{unit}/min"},
	}

	gaugeMap := make(map[string]metric.Float64Gauge, len(gauges))
	for name, meta := range gauges {
		opts := []metric.Float64GaugeOption{
			metric.WithUnit(meta.unit),
		}
		g, err := m.Float64Gauge(name, opts...)
		if err != nil {
			return nil, fmt.Errorf("create gauge %q: %w", name, err)
		}
		gaugeMap[name] = g
	}

	return &Instruments{GaugeMap: gaugeMap}, nil
}

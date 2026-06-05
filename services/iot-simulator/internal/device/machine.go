package device

import "fmt"

var machineManufacturers = []string{"IndustrialAI", "CityRobotics", "UrbanMech"}

// Machine simulates an industrial IoT node (factory/utility equipment).
type Machine struct {
	info             DeviceInfo
	baseVibration    float64
	baseCycleCount   float64
	baseTemp         float64
	baseErrorRate    float64
	baseThroughput   float64
}

// NewMachine constructs a Machine with index-derived baseline values.
func NewMachine(index int) *Machine {
	return &Machine{
		info: DeviceInfo{
			ID:           fmt.Sprintf("mach-%03d", index),
			Zone:         Zones[index%len(Zones)],
			Manufacturer: machineManufacturers[index%len(machineManufacturers)],
			Category:     CategoryMachine,
		},
		baseVibration:  1.5 + float64(index%4),
		baseCycleCount: float64(800 + index*60),
		baseTemp:       50 + float64(index%20),
		baseErrorRate:  0.3 + float64(index%3)*0.4,
		baseThroughput: 90 + float64(index*6),
	}
}

// Info returns static device metadata.
func (m *Machine) Info() DeviceInfo { return m.info }

// Readings returns a snapshot of sensor values, optionally with an injected anomaly.
func (m *Machine) Readings(anomaly AnomalyType) map[string]float64 {
	vibration := noiseFloat(m.baseVibration, 0.15)
	cycleCount := m.baseCycleCount
	temp := noiseFloat(m.baseTemp, 0.05)
	errorRate := noiseFloat(m.baseErrorRate, 0.20)
	throughput := noiseFloat(m.baseThroughput, 0.10)

	switch anomaly {
	case AnomalyHighVibration:
		vibration = noiseFloat(12, 0.08)
	case AnomalyHighErrorRate:
		errorRate = noiseFloat(8.5, 0.10)
	}

	return map[string]float64{
		"iot.machine.vibration":   vibration,
		"iot.machine.cycle_count": cycleCount,
		"iot.machine.temp":        temp,
		"iot.machine.error_rate":  errorRate,
		"iot.machine.throughput":  throughput,
	}
}

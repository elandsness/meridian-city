package device

import (
	"math/rand"
	"sync"
)

// Category identifies the class of IoT device.
type Category string

const (
	CategoryVehicle  Category = "vehicle"
	CategoryBuilding Category = "building"
	CategoryMachine  Category = "machine"
)

// AnomalyType identifies a simulated fault condition.
type AnomalyType string

const (
	AnomalyNone            AnomalyType = ""
	AnomalyHVACOvertemp    AnomalyType = "hvac_overtemp"
	AnomalyEngineOvertemp  AnomalyType = "engine_overtemp"
	AnomalyHighVibration   AnomalyType = "high_vibration"
	AnomalyHighErrorRate   AnomalyType = "high_error_rate"
	AnomalyHighSpeed       AnomalyType = "high_speed"
)

// Zones is the set of geographic zones devices can be assigned to.
var Zones = []string{"zone-north", "zone-south", "zone-east", "zone-west", "zone-central"}

// DeviceInfo carries static metadata about a device.
type DeviceInfo struct {
	ID           string
	Zone         string
	Manufacturer string
	Category     Category
}

// Device is the interface all IoT device types must implement.
type Device interface {
	Info() DeviceInfo
	Readings(anomaly AnomalyType) map[string]float64
}

// State holds the mutable runtime state for a device worker.
type State struct {
	mu      sync.RWMutex
	Anomaly AnomalyType
}

// SetAnomaly stores an anomaly on the device state (thread-safe).
func (s *State) SetAnomaly(a AnomalyType) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.Anomaly = a
}

// GetAnomaly retrieves the current anomaly (thread-safe).
func (s *State) GetAnomaly() AnomalyType {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.Anomaly
}

// noiseFloat returns v with ±pct*100% random noise applied.
// pct=0.05 means ±5%.
func noiseFloat(v, pct float64) float64 {
	// rand.Float64() ∈ [0.0, 1.0) → shift to [-1.0, 1.0)
	factor := 1.0 + pct*(rand.Float64()*2-1)
	return v * factor
}

package fleet

import (
	"context"
	"log"
	"math/rand"
	"sync"
	"time"

	"github.com/meridian/iot-service/internal/config"
)

// DeviceType represents the type of IoT device.
type DeviceType string

const (
	DeviceTypeVehicle DeviceType = "vehicle"
	DeviceTypeBuilding DeviceType = "building"
	DeviceTypeMachine DeviceType = "machine"
)

// Device represents a simulated IoT device.
type Device struct {
	ID          string
	Type        DeviceType
	Metrics     map[string]float64
	Anomalous   bool
	LastUpdated time.Time
}

// FleetManager manages the simulated IoT device fleet.
type FleetManager struct {
	config      config.SimulatorFleetConfig
	devices     map[string]*Device
	mu          sync.RWMutex
	stopCh      chan struct{}
}

// NewManager creates a new FleetManager.
func NewManager(cfg config.SimulatorFleetConfig) *FleetManager {
	return &FleetManager{
		config: cfg,
		devices: make(map[string]*Device),
		stopCh: make(chan struct{}),
	}
}

// Start begins the simulation.
func (fm *FleetManager) Start() {
	if !fm.config.Enabled {
		log.Println("Simulator disabled")
		return
	}

	log.Printf("Starting simulator fleet: %d vehicles, %d buildings, %d machines",
		fm.config.Vehicles.Count, fm.config.Buildings.Count, fm.config.Machines.Count)

	go fm.runSimulation()
}

// Stop halts the simulation.
func (fm *FleetManager) Stop() {
	close(fm.stopCh)
}

// runSimulation is the main simulation loop.
func (fm *FleetManager) runSimulation() {
	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			fm.emitMetrics()
		case <-fm.stopCh:
			return
		}
	}
}

// emitMetrics generates metrics for all devices.
func (fm *FleetManager) emitMetrics() {
	fm.mu.Lock()
	defer fm.mu.Unlock()

	for _, device := range fm.devices {
		fm.updateMetrics(device)
		device.LastUpdated = time.Now()
	}
}

// updateMetrics updates a single device's metrics based on its type.
func (fm *FleetManager) updateMetrics(device *Device) {
	switch device.Type {
	case DeviceTypeVehicle:
		device.Metrics["speed"] = 40 + rand.Float64()*80 // 40-120 km/h
		device.Metrics["engine_temp"] = 80 + rand.Float64()*40 // 80-120°C
		device.Metrics["fuel_level"] = 20 + rand.Float64()*80 // 20-100%
	case DeviceTypeBuilding:
		device.Metrics["hvac_temp"] = 68 + rand.Float64()*20 // 68-88°C
		device.Metrics["hvac_setpoint"] = 72.0
		device.Metrics["energy_kwh"] = 100 + rand.Float64()*400 // 100-500 kWh
		device.Metrics["occupancy"] = 0.3 + rand.Float64()*0.7 // 30-100%
		device.Metrics["co2_ppm"] = 400 + rand.Float64()*800 // 400-1200 ppm
	case DeviceTypeMachine:
		device.Metrics["vibration"] = 0.1 + rand.Float64()*1.5 // 0.1-1.6 mm/s
		device.Metrics["cycle_count"] = rand.Intn(1000)
		device.Metrics["temp"] = 20 + rand.Float64()*80 // 20-100°C
		device.Metrics["error_rate"] = rand.Float64() * 10 // 0-10%
		device.Metrics["throughput"] = 50 + rand.Float64()*150 // 50-200 units/min
	}
}

// GetFleetStatus returns the current fleet status.
func (fm *FleetManager) GetFleetStatus() []map[string]interface{} {
	fm.mu.RLock()
	defer fm.mu.RUnlock()

	status := make([]map[string]interface{}, 0, len(fm.devices))
	for _, device := range fm.devices {
		status = append(status, map[string]interface{}{
			"id":          device.ID,
			"type":        device.Type,
			"anomalous":   device.Anomalous,
			"last_updated": device.LastUpdated,
			"metrics":     device.Metrics,
		})
	}
	return status
}

// InjectAnomaly triggers an anomaly on a device.
func (fm *FleetManager) InjectAnomaly(deviceID string) error {
	fm.mu.Lock()
	defer fm.mu.Unlock()

	device, ok := fm.devices[deviceID]
	if !ok {
		return &DeviceNotFoundError{DeviceID: deviceID}
	}

	device.Anomalous = true
	log.Printf("Injected anomaly on device %s", deviceID)
	return nil
}

// ClearAnomaly clears an anomaly on a device.
func (fm *FleetManager) ClearAnomaly(deviceID string) error {
	fm.mu.Lock()
	defer fm.mu.Unlock()

	device, ok := fm.devices[deviceID]
	if !ok {
		return &DeviceNotFoundError{DeviceID: deviceID}
	}

	device.Anomalous = false
	log.Printf("Cleared anomaly on device %s", deviceID)
	return nil
}

// DeviceNotFoundError is returned when a device is not found.
type DeviceNotFoundError struct {
	DeviceID string
}

func (e *DeviceNotFoundError) Error() string {
	return "device not found: " + e.DeviceID
}

// context.Context is used for graceful shutdown in production code.
var _ context.Context

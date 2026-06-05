package fleet

import (
	"context"
	"fmt"
	"log"
	"math/rand"
	"sync"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/metric"

	"github.com/meridian/iot-simulator/internal/device"
	"github.com/meridian/iot-simulator/internal/telemetry"
)

// DeviceWorker couples a Device with its mutable state and goroutine lifecycle.
type DeviceWorker struct {
	Device device.Device
	State  *device.State
	cancel context.CancelFunc
}

// Manager owns and coordinates all device goroutines.
type Manager struct {
	mu            sync.RWMutex
	workers       map[string]*DeviceWorker
	vehicleCount  int
	buildingCount int
	machineCount  int
	emitInterval  int
	instruments   *telemetry.Instruments
}

// FleetStatus is the JSON-serialisable snapshot of the entire fleet.
type FleetStatus struct {
	Vehicles  CategoryStatus `json:"vehicles"`
	Buildings CategoryStatus `json:"buildings"`
	Machines  CategoryStatus `json:"machines"`
}

// CategoryStatus summarises one device category.
type CategoryStatus struct {
	Count     int               `json:"count"`
	Anomalies map[string]string `json:"anomalies"` // deviceID → anomalyType
}

// NewManager creates an uninitialised Manager.
func NewManager(emitIntervalSeconds int) *Manager {
	return &Manager{
		workers:      make(map[string]*DeviceWorker),
		emitInterval: emitIntervalSeconds,
	}
}

// Initialize creates the initial device fleet and starts all goroutines.
// Panics if instruments cannot be created (programming error / OTel misconfiguration).
func (m *Manager) Initialize(ctx context.Context, vehicles, buildings, machines int) {
	instr, err := telemetry.NewInstruments()
	if err != nil {
		panic(fmt.Sprintf("fleet: cannot create OTel instruments: %v", err))
	}
	m.instruments = instr

	for i := 0; i < vehicles; i++ {
		m.spawnDevice(ctx, device.NewVehicle(i))
	}
	for i := 0; i < buildings; i++ {
		m.spawnDevice(ctx, device.NewBuilding(i))
	}
	for i := 0; i < machines; i++ {
		m.spawnDevice(ctx, device.NewMachine(i))
	}

	m.mu.Lock()
	m.vehicleCount = vehicles
	m.buildingCount = buildings
	m.machineCount = machines
	m.mu.Unlock()

	log.Printf("fleet: initialised %d vehicles, %d buildings, %d machines", vehicles, buildings, machines)
}

// spawnDevice creates a worker and starts its goroutine.
func (m *Manager) spawnDevice(ctx context.Context, d device.Device) {
	info := d.Info()
	devCtx, cancel := context.WithCancel(ctx)
	w := &DeviceWorker{
		Device: d,
		State:  &device.State{},
		cancel: cancel,
	}

	m.mu.Lock()
	m.workers[info.ID] = w
	m.mu.Unlock()

	go m.runDevice(devCtx, d, w.State)
}

// stopDevice cancels a device goroutine and removes it from the map.
func (m *Manager) stopDevice(id string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	w, ok := m.workers[id]
	if !ok {
		return
	}
	w.cancel()
	delete(m.workers, id)
}

// ResizeFleet adjusts the number of running devices in each category.
func (m *Manager) ResizeFleet(ctx context.Context, vehicles, buildings, machines int) {
	m.mu.Lock()
	curVehicles := m.vehicleCount
	curBuildings := m.buildingCount
	curMachines := m.machineCount
	m.mu.Unlock()

	resizeCategory(ctx, m, curVehicles, vehicles, "veh", func(i int) device.Device {
		return device.NewVehicle(i)
	})
	resizeCategory(ctx, m, curBuildings, buildings, "bldg", func(i int) device.Device {
		return device.NewBuilding(i)
	})
	resizeCategory(ctx, m, curMachines, machines, "mach", func(i int) device.Device {
		return device.NewMachine(i)
	})

	m.mu.Lock()
	m.vehicleCount = vehicles
	m.buildingCount = buildings
	m.machineCount = machines
	m.mu.Unlock()

	log.Printf("fleet: resized to %d vehicles, %d buildings, %d machines", vehicles, buildings, machines)
}

func resizeCategory(ctx context.Context, m *Manager, current, target int, prefix string, ctor func(int) device.Device) {
	if target > current {
		for i := current; i < target; i++ {
			m.spawnDevice(ctx, ctor(i))
		}
	} else if target < current {
		for i := current - 1; i >= target; i-- {
			id := fmt.Sprintf("%s-%03d", prefix, i)
			m.stopDevice(id)
		}
	}
}

// SetAnomaly injects a fault on the named device.
func (m *Manager) SetAnomaly(deviceID string, anomalyType device.AnomalyType) error {
	m.mu.RLock()
	w, ok := m.workers[deviceID]
	m.mu.RUnlock()
	if !ok {
		return fmt.Errorf("device %q not found", deviceID)
	}
	w.State.SetAnomaly(anomalyType)
	log.Printf("fleet: anomaly %q set on %s", anomalyType, deviceID)
	return nil
}

// ClearAnomaly removes any active fault from the named device.
func (m *Manager) ClearAnomaly(deviceID string) error {
	m.mu.RLock()
	w, ok := m.workers[deviceID]
	m.mu.RUnlock()
	if !ok {
		return fmt.Errorf("device %q not found", deviceID)
	}
	w.State.SetAnomaly(device.AnomalyNone)
	log.Printf("fleet: anomaly cleared on %s", deviceID)
	return nil
}

// FleetStatus returns a point-in-time snapshot of the fleet.
func (m *Manager) FleetStatus() FleetStatus {
	m.mu.RLock()
	defer m.mu.RUnlock()

	status := FleetStatus{
		Vehicles:  CategoryStatus{Anomalies: make(map[string]string)},
		Buildings: CategoryStatus{Anomalies: make(map[string]string)},
		Machines:  CategoryStatus{Anomalies: make(map[string]string)},
	}

	for id, w := range m.workers {
		info := w.Device.Info()
		anomaly := string(w.State.GetAnomaly())
		switch info.Category {
		case device.CategoryVehicle:
			status.Vehicles.Count++
			if anomaly != "" {
				status.Vehicles.Anomalies[id] = anomaly
			}
		case device.CategoryBuilding:
			status.Buildings.Count++
			if anomaly != "" {
				status.Buildings.Anomalies[id] = anomaly
			}
		case device.CategoryMachine:
			status.Machines.Count++
			if anomaly != "" {
				status.Machines.Anomalies[id] = anomaly
			}
		}
	}

	return status
}

// StopAll cancels every device goroutine.
func (m *Manager) StopAll() {
	m.mu.Lock()
	defer m.mu.Unlock()
	for id, w := range m.workers {
		w.cancel()
		delete(m.workers, id)
	}
	log.Println("fleet: all devices stopped")
}

// runDevice is the per-device goroutine. It emits metrics and a trace span on each tick.
func (m *Manager) runDevice(ctx context.Context, d device.Device, state *device.State) {
	info := d.Info()

	// Stagger startup by up to 5 seconds to avoid a thundering-herd on the first tick.
	jitter := time.Duration(rand.Intn(5000)) * time.Millisecond
	select {
	case <-time.After(jitter):
	case <-ctx.Done():
		return
	}

	ticker := time.NewTicker(time.Duration(m.emitInterval) * time.Second)
	defer ticker.Stop()

	tracer := otel.Tracer("iot-simulator")

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			anomaly := state.GetAnomaly()
			readings := d.Readings(anomaly)

			spanCtx, span := tracer.Start(ctx, "device.telemetry.emit")
			span.SetAttributes(
				attribute.String("device.id", info.ID),
				attribute.String("device.category", string(info.Category)),
				attribute.String("device.zone", info.Zone),
			)

			attrs := metric.WithAttributes(
				attribute.String("device.id", info.ID),
				attribute.String("device.zone", info.Zone),
				attribute.String("device.manufacturer", info.Manufacturer),
				attribute.String("device.category", string(info.Category)),
			)

			for metricName, value := range readings {
				if g, ok := m.instruments.GaugeMap[metricName]; ok {
					g.Record(spanCtx, value, attrs)
				}
			}

			span.End()
		}
	}
}

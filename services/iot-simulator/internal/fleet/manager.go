// Package fleet owns the in-memory device population: spawning/removing
// devices (with parent/child hierarchy), and the per-device tick loop that
// mutates metric values and emits them as OTel gauges (plus occasional log
// lines), applying any active fault gate along the way.
package fleet

import (
	"context"
	"fmt"
	"math/rand"
	"sync"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	otelmetric "go.opentelemetry.io/otel/metric"
	"go.opentelemetry.io/otel/trace"

	"github.com/meridian/iot-simulator/internal/config"
	"github.com/meridian/iot-simulator/internal/faultgate"
	"github.com/meridian/iot-simulator/internal/pattern"
	"github.com/meridian/iot-simulator/internal/telemetry"
)

// Manager owns and coordinates every device goroutine.
type Manager struct {
	mu sync.RWMutex

	topTypes      map[string]config.DeviceType
	childTypes    map[string]map[string]config.ChildDeviceType // parentType -> childType -> def
	defaultTickMs int

	gates       *faultgate.Registry
	instruments *telemetry.Instruments
	logs        *telemetry.LogEmitter

	seq        map[string]int
	devices    map[string]*Device
	childrenOf map[string][]string // parentID -> []childID
}

func NewManager(cfg *config.Config, gates *faultgate.Registry, instruments *telemetry.Instruments, logs *telemetry.LogEmitter) *Manager {
	m := &Manager{
		topTypes:      make(map[string]config.DeviceType),
		childTypes:    make(map[string]map[string]config.ChildDeviceType),
		defaultTickMs: cfg.EffectiveTickIntervalMs(0),
		gates:         gates,
		instruments:   instruments,
		logs:          logs,
		seq:           make(map[string]int),
		devices:       make(map[string]*Device),
		childrenOf:    make(map[string][]string),
	}
	for _, dt := range cfg.DeviceTypes {
		m.topTypes[dt.Type] = dt
		children := make(map[string]config.ChildDeviceType, len(dt.Children))
		for _, c := range dt.Children {
			children[c.Type] = c
		}
		m.childTypes[dt.Type] = children
	}
	return m
}

// Initialize spawns the fleet's starting population from config.
func (m *Manager) Initialize(ctx context.Context) {
	for _, dt := range m.topTypes {
		for i := 0; i < dt.Count; i++ {
			m.spawnTop(ctx, dt)
		}
	}
}

func (m *Manager) spawnTop(ctx context.Context, dt config.DeviceType) *Device {
	d := m.newDevice(dt.Type, "", dt.Metrics, dt.Logs, dt.TickIntervalMs)
	m.register(d)
	m.startTicking(ctx, d)

	for _, child := range dt.Children {
		for i := 0; i < child.CountPerParent; i++ {
			m.spawnChild(ctx, child, d.ID)
		}
	}
	return d
}

func (m *Manager) spawnChild(ctx context.Context, ct config.ChildDeviceType, parentID string) *Device {
	d := m.newDevice(ct.Type, parentID, ct.Metrics, ct.Logs, ct.TickIntervalMs)
	m.register(d)
	m.startTicking(ctx, d)
	return d
}

func (m *Manager) newDevice(deviceType, parentID string, metrics []config.Metric, logCfg *config.LogConfig, tickOverrideMs int) *Device {
	m.mu.Lock()
	m.seq[deviceType]++
	n := m.seq[deviceType]
	m.mu.Unlock()

	tickMs := m.defaultTickMs
	if tickOverrideMs > 0 {
		tickMs = tickOverrideMs
	}

	d := &Device{
		ID:             fmt.Sprintf("%s-%03d", deviceType, n),
		Type:           deviceType,
		ParentID:       parentID,
		CreatedAt:      time.Now(),
		metrics:        metrics,
		logCfg:         logCfg,
		tickIntervalMs: tickMs,
		values:         make(map[string]float64, len(metrics)),
	}
	for _, metricDef := range metrics {
		d.values[metricDef.Name] = pattern.Seed(metricDef.Pattern, metricDef.Min, metricDef.Max, metricDef.PeriodSeconds)
	}
	return d
}

func (m *Manager) register(d *Device) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.devices[d.ID] = d
	if d.ParentID != "" {
		m.childrenOf[d.ParentID] = append(m.childrenOf[d.ParentID], d.ID)
	}
}

func (m *Manager) startTicking(parentCtx context.Context, d *Device) {
	ctx, cancel := context.WithCancel(parentCtx)
	d.cancel = cancel
	go m.runDevice(ctx, d)
}

// runDevice is the per-device goroutine: staggers its first tick (to avoid a
// thundering herd), then emits on its own ticker until cancelled.
func (m *Manager) runDevice(ctx context.Context, d *Device) {
	jitter := time.Duration(rand.Intn(5000)) * time.Millisecond
	select {
	case <-time.After(jitter):
	case <-ctx.Done():
		return
	}

	ticker := time.NewTicker(time.Duration(d.tickIntervalMs) * time.Millisecond)
	defer ticker.Stop()

	tracer := otel.Tracer("iot-simulator")

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			m.tick(ctx, tracer, d)
		}
	}
}

func (m *Manager) tick(ctx context.Context, tracer trace.Tracer, d *Device) {
	spanCtx, span := tracer.Start(ctx, "device.telemetry.emit")
	defer span.End()
	span.SetAttributes(
		attribute.String("device.id", d.ID),
		attribute.String("device.type", d.Type),
	)
	if d.ParentID != "" {
		span.SetAttributes(attribute.String("device.parent_id", d.ParentID))
	}

	elapsed := time.Since(d.CreatedAt).Seconds()
	gate, hasGate := m.gates.Get(d.Type)

	attrs := otelmetric.WithAttributes(
		attribute.String("device.id", d.ID),
		attribute.String("device.type", d.Type),
	)

	for _, metricDef := range d.metrics {
		current := d.getValue(metricDef.Name)
		next := pattern.Next(metricDef.Pattern, current, metricDef.Min, metricDef.Max, metricDef.PeriodSeconds, elapsed)
		if hasGate && gate.Applies(metricDef.Name, rand.Float64()) {
			next = gate.Apply(next)
		}
		d.setValue(metricDef.Name, next)

		if g, ok := m.instruments.GaugeMap[metricDef.Name]; ok {
			g.Record(spanCtx, next, attrs)
		}
	}

	if d.logCfg != nil && len(d.logCfg.Messages) > 0 && rand.Float64() < d.logCfg.EmitProbabilityPerTick {
		msg := d.logCfg.Messages[rand.Intn(len(d.logCfg.Messages))]
		m.logs.Emit(spanCtx, msg.Level, msg.Template, d.ID, d.Type, d.ParentID)
	}
}

// AddDevices spawns `count` new devices. If parentID is empty, deviceType
// must be a configured top-level type, and each new instance also spawns its
// configured children (per their countPerParent). If parentID is set,
// deviceType must be a configured child type of that parent's device type,
// and exactly that many children are added under the given parent.
func (m *Manager) AddDevices(ctx context.Context, deviceType string, count int, parentID string) ([]Snapshot, error) {
	if count <= 0 {
		return nil, fmt.Errorf("count must be positive")
	}

	if parentID != "" {
		m.mu.RLock()
		parent, ok := m.devices[parentID]
		m.mu.RUnlock()
		if !ok {
			return nil, fmt.Errorf("parent device %q not found", parentID)
		}

		m.mu.RLock()
		ct, ok := m.childTypes[parent.Type][deviceType]
		m.mu.RUnlock()
		if !ok {
			return nil, fmt.Errorf("%q is not a configured child type of %q", deviceType, parent.Type)
		}

		out := make([]Snapshot, 0, count)
		for i := 0; i < count; i++ {
			out = append(out, m.spawnChild(ctx, ct, parentID).Snapshot())
		}
		return out, nil
	}

	m.mu.RLock()
	dt, ok := m.topTypes[deviceType]
	m.mu.RUnlock()
	if !ok {
		return nil, fmt.Errorf("%q is not a configured device type", deviceType)
	}

	out := make([]Snapshot, 0, count)
	for i := 0; i < count; i++ {
		d := m.spawnTop(ctx, dt)
		out = append(out, d.Snapshot())
		out = append(out, m.childSnapshots(d.ID)...)
	}
	return out, nil
}

func (m *Manager) childSnapshots(parentID string) []Snapshot {
	m.mu.RLock()
	ids := append([]string(nil), m.childrenOf[parentID]...)
	m.mu.RUnlock()

	out := make([]Snapshot, 0, len(ids))
	for _, id := range ids {
		m.mu.RLock()
		d := m.devices[id]
		m.mu.RUnlock()
		if d != nil {
			out = append(out, d.Snapshot())
		}
	}
	return out
}

// RemoveDevice stops and removes a device, cascading to its children.
func (m *Manager) RemoveDevice(id string) error {
	m.mu.Lock()
	d, ok := m.devices[id]
	if !ok {
		m.mu.Unlock()
		return fmt.Errorf("device %q not found", id)
	}
	children := append([]string(nil), m.childrenOf[id]...)
	delete(m.devices, id)
	delete(m.childrenOf, id)
	if d.ParentID != "" {
		siblings := m.childrenOf[d.ParentID]
		for i, sid := range siblings {
			if sid == id {
				m.childrenOf[d.ParentID] = append(siblings[:i], siblings[i+1:]...)
				break
			}
		}
	}
	m.mu.Unlock()

	if d.cancel != nil {
		d.cancel()
	}
	for _, cid := range children {
		_ = m.RemoveDevice(cid) // best-effort cascade
	}
	return nil
}

// ListDevices returns a snapshot of every device, optionally filtered by type.
func (m *Manager) ListDevices(typeFilter string) []Snapshot {
	m.mu.RLock()
	defer m.mu.RUnlock()
	out := make([]Snapshot, 0, len(m.devices))
	for _, d := range m.devices {
		if typeFilter != "" && d.Type != typeFilter {
			continue
		}
		out = append(out, d.Snapshot())
	}
	return out
}

// StopAll cancels every device goroutine.
func (m *Manager) StopAll() {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, d := range m.devices {
		if d.cancel != nil {
			d.cancel()
		}
	}
}

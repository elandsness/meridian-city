// Package faultgate implements ongoing, probabilistic problem injection
// scoped to a device type -- the same {enabled, rate} admin shape as
// entity-engine's FaultGateRegistry, extended with an optional metric
// target and a magnitude (percent / absolute / set-value) describing how
// the metric should be pushed when the gate fires.
package faultgate

import "sync"

// Magnitude describes how a faulted metric's value should be altered.
type Magnitude struct {
	Type  string  `json:"type"` // percent | absolute | setValue
	Value float64 `json:"value"`
}

// Gate is the admin-configurable fault state for one device type.
type Gate struct {
	Enabled   bool      `json:"enabled"`
	Rate      float64   `json:"rate"`             // probability per device per tick, 0..1
	Metric    string    `json:"metric,omitempty"` // empty = every metric on this device type
	Magnitude Magnitude `json:"magnitude"`
}

// Registry holds the current fault gate per device type. Zero value is
// ready to use.
type Registry struct {
	mu    sync.RWMutex
	gates map[string]Gate
}

func NewRegistry() *Registry {
	return &Registry{gates: make(map[string]Gate)}
}

func (r *Registry) Get(deviceType string) (Gate, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	g, ok := r.gates[deviceType]
	return g, ok
}

func (r *Registry) Set(deviceType string, g Gate) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.gates[deviceType] = g
}

func (r *Registry) Clear(deviceType string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.gates, deviceType)
}

func (r *Registry) List() map[string]Gate {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make(map[string]Gate, len(r.gates))
	for k, v := range r.gates {
		out[k] = v
	}
	return out
}

// Applies reports whether this gate should fire this tick for one device,
// and whether it targets the given metric.
func (g Gate) Applies(metricName string, roll float64) bool {
	if !g.Enabled {
		return false
	}
	if g.Metric != "" && g.Metric != metricName {
		return false
	}
	return roll < g.Rate
}

// Apply shifts value per the gate's magnitude. Deliberately NOT clamped to
// the metric's normal [min,max] -- the point of a fault is to push the
// reading outside its normal range so Dynatrace's own anomaly detection has
// something real to react to.
func (g Gate) Apply(value float64) float64 {
	switch g.Magnitude.Type {
	case "percent":
		return value * (1 + g.Magnitude.Value/100)
	case "absolute":
		return value + g.Magnitude.Value
	case "setValue":
		return g.Magnitude.Value
	default:
		return value
	}
}

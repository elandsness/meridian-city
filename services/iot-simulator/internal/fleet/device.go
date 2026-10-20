package fleet

import (
	"sync"
	"time"

	"github.com/meridian/iot-simulator/internal/config"
)

// Device is one simulated device instance (a specific train, door, switch,
// ...). Its metric/log config is copied in at spawn time so the tick loop
// never needs to re-resolve the owning type.
type Device struct {
	ID        string
	Type      string
	ParentID  string
	CreatedAt time.Time

	metrics        []config.Metric
	logCfg         *config.LogConfig
	tickIntervalMs int

	mu     sync.RWMutex
	values map[string]float64
	cancel func()
}

// Snapshot is the JSON-serializable view of a device returned by the admin API.
type Snapshot struct {
	ID       string             `json:"id"`
	Type     string             `json:"type"`
	ParentID string             `json:"parent_id,omitempty"`
	Values   map[string]float64 `json:"values"`
}

func (d *Device) Snapshot() Snapshot {
	d.mu.RLock()
	defer d.mu.RUnlock()
	values := make(map[string]float64, len(d.values))
	for k, v := range d.values {
		values[k] = v
	}
	return Snapshot{ID: d.ID, Type: d.Type, ParentID: d.ParentID, Values: values}
}

func (d *Device) getValue(metric string) float64 {
	d.mu.RLock()
	defer d.mu.RUnlock()
	return d.values[metric]
}

func (d *Device) setValue(metric string, v float64) {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.values[metric] = v
}

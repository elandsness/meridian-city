// Package config loads the industry.iot device-fleet definition: how many
// devices of which types to simulate, what sensor metrics they report (and
// over what value range), their log behavior, and any parent/child hierarchy
// (e.g. a train has several doors). This is the only place the fleet's shape
// is industry-specific -- everything downstream (fleet, pattern, admin) is
// generic across whatever device types a config declares.
package config

// Config is the root industry.iot block.
type Config struct {
	Enabled        bool         `json:"enabled"`
	TickIntervalMs int          `json:"tickIntervalMs"`
	DeviceTypes    []DeviceType `json:"deviceTypes"`
}

// DeviceType is one top-level simulated device kind (e.g. "train").
type DeviceType struct {
	Type           string            `json:"type"`
	DisplayName    string            `json:"displayName"`
	Count          int               `json:"count"`
	TickIntervalMs int               `json:"tickIntervalMs"`
	Metrics        []Metric          `json:"metrics"`
	Logs           *LogConfig        `json:"logs"`
	Children       []ChildDeviceType `json:"children"`
}

// ChildDeviceType is a device that only exists attached to a parent of the
// enclosing DeviceType (e.g. "door" under "train"). Children cannot nest
// further -- one level of hierarchy is all the simulator supports.
type ChildDeviceType struct {
	Type           string     `json:"type"`
	DisplayName    string     `json:"displayName"`
	CountPerParent int        `json:"countPerParent"`
	TickIntervalMs int        `json:"tickIntervalMs"`
	Metrics        []Metric   `json:"metrics"`
	Logs           *LogConfig `json:"logs"`
}

// Metric is one simulated sensor reading.
type Metric struct {
	Name          string  `json:"name"`
	Unit          string  `json:"unit"`
	Min           float64 `json:"min"`
	Max           float64 `json:"max"`
	Pattern       string  `json:"pattern"` // steady | driftRandom | cyclic
	PeriodSeconds float64 `json:"periodSeconds"`
}

// LogConfig describes optional log-line emission alongside metrics.
type LogConfig struct {
	EmitProbabilityPerTick float64      `json:"emitProbabilityPerTick"`
	Messages               []LogMessage `json:"messages"`
}

// LogMessage is one templated log line. Template may reference {device_id},
// {device_type}, and {parent_id}.
type LogMessage struct {
	Level    string `json:"level"`
	Template string `json:"template"`
}

const (
	PatternSteady      = "steady"
	PatternDriftRandom = "driftRandom"
	PatternCyclic      = "cyclic"
)

const defaultTickIntervalMs = 30000

// EffectiveTickIntervalMs returns the type's own interval, falling back to
// the type's declared value, then the config-wide default, then a hardcoded
// fallback so a malformed config never produces a zero/negative ticker.
func (c *Config) EffectiveTickIntervalMs(override int) int {
	if override > 0 {
		return override
	}
	if c.TickIntervalMs > 0 {
		return c.TickIntervalMs
	}
	return defaultTickIntervalMs
}

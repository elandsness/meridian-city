package config

import (
	"encoding/json"
	"fmt"
	"os"
)

// Load reads and parses the industry.iot JSON mounted at path (see
// helm/templates/iot-config-configmap.yaml). A missing file is not an
// error -- it returns an empty, disabled config so the service can still
// start (and serve /health) on a deploy that hasn't configured any devices.
func Load(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		return &Config{}, nil
	}
	if err != nil {
		return nil, fmt.Errorf("read iot config %q: %w", path, err)
	}

	var cfg Config
	if err := json.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("parse iot config %q: %w", path, err)
	}
	return &cfg, nil
}

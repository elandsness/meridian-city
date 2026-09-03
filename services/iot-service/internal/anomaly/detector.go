package anomaly

import (
	"log"
	"sync"
	"time"

	"github.com/meridian/iot-service/internal/config"
	"github.com/meridian/iot-service/internal/kafka"
)

// Detector monitors telemetry and detects anomalies based on configured thresholds.
type Detector struct {
	config      config.AnomalyThresholds
	producer    *kafka.Producer
	readings    map[string]*ReadingWindow
	mu          sync.RWMutex
	stopCh      chan struct{}
}

// ReadingWindow tracks consecutive readings for threshold detection.
type ReadingWindow struct {
	DeviceID   string
	Metric     string
	Values     []float64
	Threshold  float64
	Consecutive int
	Severity   string
}

// NewDetector creates a new anomaly detector.
func NewDetector(cfg config.AnomalyThresholds, producer *kafka.Producer) *Detector {
	return &Detector{
		config:   cfg,
		producer: producer,
		readings: make(map[string]*ReadingWindow),
		stopCh:   make(chan struct{}),
	}
}

// Start begins the anomaly detection loop.
func (d *Detector) Start() {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			d.checkAnomalies()
		case <-d.stopCh:
			return
		}
	}
}

// Stop halts the detector.
func (d *Detector) Stop() {
	close(d.stopCh)
}

// AddReading adds a telemetry reading and checks for anomalies.
func (d *Detector) AddReading(deviceID string, deviceType string, metric string, value float64) {
	key := deviceID + ":" + metric

	d.mu.Lock()
	defer d.mu.Unlock()

	window, ok := d.readings[key]
	if !ok {
		window = &ReadingWindow{
			DeviceID:  deviceID,
			Metric:    metric,
			Threshold: d.getThreshold(deviceType, metric),
		}
		d.readings[key] = window
	}

	window.Values = append(window.Values, value)
	if len(window.Values) > 10 {
		window.Values = window.Values[1:]
	}

	// Check if value exceeds threshold
	if value > window.Threshold {
		window.Consecutive++
		if window.Consecutive >= 3 {
			// Anomaly detected
			d.emitAnomaly(deviceID, deviceType, metric, value, window.Threshold)
			window.Consecutive = 0
		}
	} else {
		window.Consecutive = 0
	}
}

// checkAnomalies periodically checks all windows for anomalies.
func (d *Detector) checkAnomalies() {
	d.mu.Lock()
	defer d.mu.Unlock()

	for _, window := range d.readings {
		if window.Consecutive >= 3 {
			d.emitAnomaly(window.DeviceID, "unknown", window.Metric, 0, window.Threshold)
		}
	}
}

// emitAnomaly publishes an anomaly to Kafka.
func (d *Detector) emitAnomaly(deviceID string, deviceType string, metric string, value float64, threshold float64) {
	severity := "warning"
	if value > threshold*1.2 {
		severity = "critical"
	}

	log.Printf("Anomaly detected: device=%s metric=%s value=%.2f threshold=%.2f severity=%s",
		deviceID, metric, value, threshold, severity)

	if err := d.producer.PublishAnomaly(nil, deviceID, deviceType, metric, value, threshold, severity); err != nil {
		log.Printf("Failed to publish anomaly: %v", err)
	}
}

// getThreshold returns the threshold for a device type and metric.
func (d *Detector) getThreshold(deviceType string, metric string) float64 {
	switch deviceType {
	case "building":
		switch metric {
		case "hvac_temp":
			return d.config.BuildingHVACTemp
		case "co2_ppm":
			return d.config.BuildingCO2PPM
		}
	case "vehicle":
		switch metric {
		case "engine_temp":
			return d.config.VehicleEngineTemp
		case "speed":
			return d.config.VehicleSpeed
		}
	case "machine":
		switch metric {
		case "vibration":
			return d.config.MachineVibration
		case "error_rate":
			return d.config.MachineErrorRate
		}
	}
	return 0
}

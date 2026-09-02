package api

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/meridian/iot-service/internal/anomaly"
	"github.com/meridian/iot-service/internal/config"
	"github.com/meridian/iot-service/internal/fleet"
	"github.com/meridian/iot-service/internal/kafka"
)

// Router sets up the REST API routes.
type Router struct {
	producer      *kafka.Producer
	fleetManager  *fleet.FleetManager
	anomalyDetector *anomaly.Detector
	config        config.Config
}

// NewRouter creates a new Router.
func NewRouter(producer *kafka.Producer, fleetManager *fleet.FleetManager, anomalyDetector *anomaly.Detector, cfg config.Config) *Router {
	return &Router{
		producer:      producer,
		fleetManager:  fleetManager,
		anomalyDetector: anomalyDetector,
		config:        cfg,
	}
}

// Handler returns the HTTP handler for the REST API.
func (r *Router) Handler() http.Handler {
	mux := http.NewServeMux()

	// Health endpoint
	mux.HandleFunc("/health", r.handleHealth)

	// Fleet endpoints
	mux.HandleFunc("/admin/fleet", r.handleFleet)
	mux.HandleFunc("/admin/fleet/anomaly", r.handleFleetAnomaly)

	// Device endpoints
	mux.HandleFunc("/api/v1/devices", r.handleDevices)

	// Telemetry endpoint
	mux.HandleFunc("/api/v1/telemetry", r.handleTelemetry)

	// Anomaly endpoints
	mux.HandleFunc("/api/v1/anomalies", r.handleAnomalies)

	return mux
}

func (r *Router) handleHealth(w http.ResponseWriter, req *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{
		"status": "healthy",
		"service": "iot-service",
	})
}

func (r *Router) handleFleet(w http.ResponseWriter, req *http.Request) {
	switch req.Method {
	case http.MethodGet:
		status := r.fleetManager.GetFleetStatus()
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"fleet_status": status,
		})
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func (r *Router) handleFleetAnomaly(w http.ResponseWriter, req *http.Request) {
	if req.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var body struct {
		DeviceID string `json:"device_id"`
	}
	if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	defer req.Body.Close()

	if err := r.fleetManager.InjectAnomaly(body.DeviceID); err != nil {
		log.Printf("Failed to inject anomaly: %v", err)
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"status": "anomaly_injected",
		"device_id": body.DeviceID,
	})
}

func (r *Router) handleDevices(w http.ResponseWriter, req *http.Request) {
	if req.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Return fleet status as device list
	status := r.fleetManager.GetFleetStatus()
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"devices": status,
	})
}

func (r *Router) handleTelemetry(w http.ResponseWriter, req *http.Request) {
	if req.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var body map[string]interface{}
	if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	defer req.Body.Close()

	deviceID, _ := body["device_id"].(string)
	deviceType, _ := body["device_type"].(string)
	metrics, _ := body["metrics"].(map[string]interface{})

	if deviceID == "" || deviceType == "" {
		http.Error(w, "device_id and device_type are required", http.StatusBadRequest)
		return
	}

	// Convert metrics to float64 map
	floatMetrics := make(map[string]float64)
	for k, v := range metrics {
		if f, ok := v.(float64); ok {
			floatMetrics[k] = f
		}
	}

	if err := r.producer.PublishTelemetry(req.Context(), deviceID, deviceType, floatMetrics); err != nil {
		log.Printf("Failed to publish telemetry: %v", err)
		http.Error(w, "Failed to publish telemetry", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"status": "telemetry_received",
		"device_id": deviceID,
	})
}

func (r *Router) handleAnomalies(w http.ResponseWriter, req *http.Request) {
	if req.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Return empty anomalies list (anomalies are published to Kafka)
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"anomalies": []interface{}{},
	})
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

// Package admin exposes the REST surface demo-control-api (and, later, a UI)
// uses to manage the simulated fleet: list configured device types, add/
// remove device instances, and toggle ongoing fault gates per device type.
package admin

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/meridian/iot-simulator/internal/config"
	"github.com/meridian/iot-simulator/internal/faultgate"
	"github.com/meridian/iot-simulator/internal/fleet"
)

type Server struct {
	mgr       *fleet.Manager
	gates     *faultgate.Registry
	cfg       *config.Config
	port      string
	startTime time.Time
}

func NewServer(mgr *fleet.Manager, gates *faultgate.Registry, cfg *config.Config, port string) *Server {
	return &Server{mgr: mgr, gates: gates, cfg: cfg, port: port, startTime: time.Now()}
}

func (s *Server) Start(ctx context.Context) error {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", s.handleHealth)
	mux.HandleFunc("GET /api/v1/iot/device-types", s.handleDeviceTypes)
	mux.HandleFunc("GET /api/v1/iot/devices", s.handleListDevices)
	mux.HandleFunc("POST /api/v1/iot/devices", s.handleAddDevices)
	mux.HandleFunc("DELETE /api/v1/iot/devices/{id}", s.handleRemoveDevice)
	mux.HandleFunc("GET /api/v1/iot/fault-gates", s.handleListFaultGates)
	mux.HandleFunc("PUT /api/v1/iot/fault-gates/{type}", s.handleSetFaultGate)
	mux.HandleFunc("DELETE /api/v1/iot/fault-gates/{type}", s.handleClearFaultGate)

	srv := &http.Server{Addr: ":" + s.port, Handler: mux}

	go func() {
		<-ctx.Done()
		shutCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = srv.Shutdown(shutCtx)
	}()

	log.Printf("admin: listening on :%s", s.port)
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		return fmt.Errorf("admin server: %w", err)
	}
	return nil
}

func (s *Server) handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"status":         "ok",
		"uptime_seconds": int(time.Since(s.startTime).Seconds()),
	})
}

// GET /api/v1/iot/device-types — the configured fleet shape, for a future UI.
func (s *Server) handleDeviceTypes(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"device_types": s.cfg.DeviceTypes})
}

// GET /api/v1/iot/devices?type=train
func (s *Server) handleListDevices(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"items": s.mgr.ListDevices(r.URL.Query().Get("type"))})
}

// POST /api/v1/iot/devices  {"type": "train", "count": 1, "parent_id": ""}
func (s *Server) handleAddDevices(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Type     string `json:"type"`
		Count    int    `json:"count"`
		ParentID string `json:"parent_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON: "+err.Error())
		return
	}
	if req.Type == "" {
		writeError(w, http.StatusBadRequest, "type is required")
		return
	}
	if req.Count <= 0 {
		req.Count = 1
	}

	items, err := s.mgr.AddDevices(r.Context(), req.Type, req.Count, req.ParentID)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"items": items})
}

// DELETE /api/v1/iot/devices/{id}
func (s *Server) handleRemoveDevice(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := s.mgr.RemoveDevice(id); err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// GET /api/v1/iot/fault-gates
func (s *Server) handleListFaultGates(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"gates": s.gates.List()})
}

// PUT /api/v1/iot/fault-gates/{type}
// {"enabled": true, "rate": 1.0, "metric": "iot.train.brake_pressure", "magnitude": {"type": "percent", "value": -40}}
func (s *Server) handleSetFaultGate(w http.ResponseWriter, r *http.Request) {
	deviceType := r.PathValue("type")
	var gate faultgate.Gate
	if err := json.NewDecoder(r.Body).Decode(&gate); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON: "+err.Error())
		return
	}
	if gate.Rate < 0 || gate.Rate > 1 {
		writeError(w, http.StatusBadRequest, "rate must be between 0 and 1")
		return
	}
	s.gates.Set(deviceType, gate)
	writeJSON(w, http.StatusOK, map[string]any{"type": deviceType, "gate": gate})
}

// DELETE /api/v1/iot/fault-gates/{type} — disable and clear the gate.
func (s *Server) handleClearFaultGate(w http.ResponseWriter, r *http.Request) {
	s.gates.Clear(r.PathValue("type"))
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, code int, msg string) {
	writeJSON(w, code, map[string]string{"error": msg})
}

package admin

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/meridian/iot-simulator/internal/device"
	"github.com/meridian/iot-simulator/internal/fleet"
)

// Server is the HTTP admin server.
type Server struct {
	mgr       *fleet.Manager
	port      string
	startTime time.Time
}

// NewServer constructs a Server. port should be just the port number, e.g. "8088".
func NewServer(mgr *fleet.Manager, port string) *Server {
	return &Server{
		mgr:       mgr,
		port:      port,
		startTime: time.Now(),
	}
}

// Start registers routes and begins listening. It blocks until ctx is cancelled.
func (s *Server) Start(ctx context.Context) error {
	mux := http.NewServeMux()
	mux.HandleFunc("/health", s.handleHealth)
	mux.HandleFunc("/admin/fleet", s.handleFleet)
	mux.HandleFunc("/admin/anomaly/", s.handleAnomalyWithID)
	mux.HandleFunc("/admin/anomaly", s.handleAnomaly)

	srv := &http.Server{
		Addr:    ":" + s.port,
		Handler: mux,
	}

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

// GET /health
func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"status":         "ok",
		"uptime_seconds": int(time.Since(s.startTime).Seconds()),
	})
}

// GET /admin/fleet  — return current fleet status
// POST /admin/fleet — resize fleet
func (s *Server) handleFleet(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		writeJSON(w, http.StatusOK, s.mgr.FleetStatus())

	case http.MethodPost:
		var req struct {
			Vehicles  int `json:"vehicles"`
			Buildings int `json:"buildings"`
			Machines  int `json:"machines"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid JSON: "+err.Error())
			return
		}
		if req.Vehicles < 0 || req.Buildings < 0 || req.Machines < 0 {
			writeError(w, http.StatusBadRequest, "counts must be non-negative")
			return
		}
		s.mgr.ResizeFleet(r.Context(), req.Vehicles, req.Buildings, req.Machines)
		writeJSON(w, http.StatusOK, s.mgr.FleetStatus())

	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

// POST /admin/anomaly — set or clear an anomaly by body
func (s *Server) handleAnomaly(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req struct {
		DeviceID string `json:"device_id"`
		Type     string `json:"type"`
		Enabled  bool   `json:"enabled"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON: "+err.Error())
		return
	}
	if req.DeviceID == "" {
		writeError(w, http.StatusBadRequest, "device_id is required")
		return
	}

	var err error
	if req.Enabled {
		err = s.mgr.SetAnomaly(req.DeviceID, device.AnomalyType(req.Type))
	} else {
		err = s.mgr.ClearAnomaly(req.DeviceID)
	}
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// DELETE /admin/anomaly/{device_id} — clear anomaly by URL path
func (s *Server) handleAnomalyWithID(w http.ResponseWriter, r *http.Request) {
	// Extract device_id from path: /admin/anomaly/{device_id}
	deviceID := strings.TrimPrefix(r.URL.Path, "/admin/anomaly/")
	if deviceID == "" {
		// No trailing segment — fall through to the POST handler if method is POST
		if r.Method == http.MethodPost {
			s.handleAnomaly(w, r)
			return
		}
		http.Error(w, "device_id required in path", http.StatusBadRequest)
		return
	}

	if r.Method != http.MethodDelete {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if err := s.mgr.ClearAnomaly(deviceID); err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
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

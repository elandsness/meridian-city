package ingestion

import (
	"context"
	"encoding/json"
	"log"
	"net"
	"net/http"
	"time"

	"github.com/meridian/iot-service/internal/kafka"
	"google.golang.org/grpc"
	"google.golang.org/protobuf/proto"
	"go.opentelemetry.io/collector/pdata/pmetric"
)

// OTLPGRPCReceiver receives OTLP metrics via gRPC.
type OTLPGRPCReceiver struct {
	port     string
	producer *kafka.Producer
	server   *grpc.Server
}

// NewOTLPGRPCReceiver creates a new OTLP gRPC receiver.
func NewOTLPGRPCReceiver(port string, producer *kafka.Producer) *OTLPGRPCReceiver {
	return &OTLPGRPCReceiver{
		port:     port,
		producer: producer,
	}
}

// Start begins listening for OTLP gRPC requests.
func (r *OTLPGRPCReceiver) Start() error {
	lis, err := net.Listen("tcp", ":"+r.port)
	if err != nil {
		return err
	}

	r.server = grpc.NewServer()
	// Register OTLP services here (simplified for brevity)
	log.Printf("OTLP gRPC receiver listening on :%s", r.port)
	return r.server.Serve(lis)
}

// Stop halts the receiver.
func (r *OTLPGRPCReceiver) Stop() {
	if r.server != nil {
		r.server.GracefulStop()
	}
}

// OTLPHTTPReceiver receives OTLP metrics via HTTP.
type OTLPHTTPReceiver struct {
	port     string
	producer *kafka.Producer
	server   *http.Server
}

// NewOTLPHTTPReceiver creates a new OTLP HTTP receiver.
func NewOTLPHTTPReceiver(port string, producer *kafka.Producer) *OTLPHTTPReceiver {
	return &OTLPHTTPReceiver{
		port:     port,
		producer: producer,
	}
}

// Start begins listening for OTLP HTTP requests.
func (r *OTLPHTTPReceiver) Start() error {
	mux := http.NewServeMux()
	mux.HandleFunc("/v1/metrics", r.handleMetrics)
	mux.HandleFunc("/v1/traces", r.handleTraces)
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	r.server = &http.Server{
		Addr:    ":" + r.port,
		Handler: mux,
	}

	log.Printf("OTLP HTTP receiver listening on :%s", r.port)
	return r.server.ListenAndServe()
}

// Stop halts the receiver.
func (r *OTLPHTTPReceiver) Stop() {
	if r.server != nil {
		r.server.Shutdown(context.Background())
	}
}

// handleMetrics processes incoming OTLP metrics.
func (r *OTLPHTTPReceiver) handleMetrics(w http.ResponseWriter, req *http.Request) {
	if req.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var metrics pmetric.Metrics
	if err := json.NewDecoder(req.Body).Decode(&metrics); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}
	defer req.Body.Close()

	// Process metrics and publish to Kafka
	resourceMetrics := metrics.ResourceMetrics()
	for i := 0; i < resourceMetrics.Len(); i++ {
		rm := resourceMetrics.At(i)
		scopeMetrics := rm.ScopeMetrics()
		for j := 0; j < scopeMetrics.Len(); j++ {
			sm := scopeMetrics.At(j)
			metricSlice := sm.Metrics()
			for k := 0; k < metricSlice.Len(); k++ {
				m := metricSlice.At(k)
				// Extract device_id from resource attributes
				deviceID := extractDeviceID(rm)
				if deviceID == "" {
					continue
				}

				deviceType := extractDeviceType(rm)
				metricsMap := extractMetricsMap(m)

				if err := r.producer.PublishTelemetry(req.Context(), deviceID, deviceType, metricsMap); err != nil {
					log.Printf("Failed to publish telemetry: %v", err)
				}
			}
		}
	}

	w.WriteHeader(http.StatusOK)
	w.Write([]byte("OK"))
}

// handleTraces processes incoming OTLP traces.
func (r *OTLPHTTPReceiver) handleTraces(w http.ResponseWriter, req *http.Request) {
	if req.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Process traces (simplified)
	w.WriteHeader(http.StatusOK)
	w.Write([]byte("OK"))
}

// extractDeviceID extracts the device_id from resource attributes.
func extractDeviceID(rm pmetric.ResourceMetrics) string {
	attrs := rm.Resource().Attributes()
	if val, ok := attrs.Get("device.id"); ok {
		return val.AsString()
	}
	return ""
}

// extractDeviceType extracts the device type from resource attributes.
func extractDeviceType(rm pmetric.ResourceMetrics) string {
	attrs := rm.Resource().Attributes()
	if val, ok := attrs.Get("device.type"); ok {
		return val.AsString()
	}
	return "unknown"
}

// extractMetricsMap extracts metric values from a metric.
func extractMetricsMap(m pmetric.Metric) map[string]float64 {
	metricsMap := make(map[string]float64)
	if m.Type() == pmetric.MetricTypeGauge {
		gauge := m.Gauge()
		for i := 0; i < gauge.DataPoints().Len(); i++ {
			dp := gauge.DataPoints().At(i)
			metricsMap["value"] = dp.DoubleValue()
		}
	}
	return metricsMap
}

// Ensure proto is imported
var _ proto.Message
var _ context.Context
var _ time.Time

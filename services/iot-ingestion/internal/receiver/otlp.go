package receiver

import (
	"context"
	"fmt"
	"log"
	"time"

	commonv1 "go.opentelemetry.io/proto/otlp/common/v1"
	metricsv1 "go.opentelemetry.io/proto/otlp/collector/metrics/v1"
	otlpmetricsv1 "go.opentelemetry.io/proto/otlp/metrics/v1"
	tracesv1 "go.opentelemetry.io/proto/otlp/collector/trace/v1"

	"github.com/meridian/iot-ingestion/internal/publisher"
	"github.com/meridian/iot-ingestion/internal/telemetry"
	"github.com/meridian/iot-ingestion/internal/validator"
)

// MetricsReceiver implements the OTLP MetricsService gRPC server.
// It validates incoming device IDs and publishes enriched readings to Kafka.
type MetricsReceiver struct {
	metricsv1.UnimplementedMetricsServiceServer
	validator *validator.Validator
	publisher *publisher.Publisher
}

// NewMetricsReceiver constructs a MetricsReceiver with the given validator and publisher.
func NewMetricsReceiver(v *validator.Validator, p *publisher.Publisher) *MetricsReceiver {
	return &MetricsReceiver{
		validator: v,
		publisher: p,
	}
}

// Export processes an ExportMetricsServiceRequest, validates devices, and publishes
// enriched TelemetryReadings to Kafka.
func (r *MetricsReceiver) Export(ctx context.Context, req *metricsv1.ExportMetricsServiceRequest) (*metricsv1.ExportMetricsServiceResponse, error) {
	ctx, span := telemetry.Tracer.Start(ctx, "otlp.metrics.receive")
	defer span.End()

	traceID := span.SpanContext().TraceID().String()

	for i, rm := range req.ResourceMetrics {
		var attrs []*commonv1.KeyValue
		if rm.Resource != nil {
			attrs = rm.Resource.Attributes
		}

		deviceID := getAttrString(attrs, "device.id")
		if deviceID == "" {
			deviceID = fmt.Sprintf("unknown-device-%d", i)
		}

		deviceType := getAttrString(attrs, "device.type")
		deviceCategory := getAttrString(attrs, "device.category")
		zone := getAttrString(attrs, "device.zone")
		manufacturer := getAttrString(attrs, "device.manufacturer")

		if !r.validator.IsKnown(deviceID) {
			log.Printf("[receiver] warning: unknown device %q — processing anyway (fail-open)", deviceID)
		}

		metrics := make(map[string]float64)
		for _, sm := range rm.ScopeMetrics {
			for _, m := range sm.Metrics {
				if val, ok := extractMetricValue(m); ok {
					metrics[m.Name] = val
				}
			}
		}

		reading := &publisher.TelemetryReading{
			DeviceID:       deviceID,
			DeviceType:     deviceType,
			DeviceCategory: deviceCategory,
			Zone:           zone,
			Manufacturer:   manufacturer,
			Timestamp:      time.Now().UTC(),
			Metrics:        metrics,
			TraceID:        traceID,
		}

		if err := r.publisher.Publish(ctx, reading); err != nil {
			log.Printf("[receiver] error publishing telemetry for device %q: %v", deviceID, err)
		}
	}

	return &metricsv1.ExportMetricsServiceResponse{}, nil
}

// getAttrString finds the first KeyValue with the given key and returns its string value.
func getAttrString(attrs []*commonv1.KeyValue, key string) string {
	for _, kv := range attrs {
		if kv.Key == key {
			if sv, ok := kv.Value.Value.(*commonv1.AnyValue_StringValue); ok {
				return sv.StringValue
			}
		}
	}
	return ""
}

// extractMetricValue pulls a float64 value from a Gauge metric's first data point.
// Returns (0, false) if the metric has no supported numeric data.
func extractMetricValue(m *otlpmetricsv1.Metric) (float64, bool) {
	if g := m.GetGauge(); g != nil {
		if len(g.DataPoints) > 0 {
			dp := g.DataPoints[0]
			switch v := dp.Value.(type) {
			case *otlpmetricsv1.NumberDataPoint_AsDouble:
				return v.AsDouble, true
			case *otlpmetricsv1.NumberDataPoint_AsInt:
				return float64(v.AsInt), true
			}
		}
	}
	if s := m.GetSum(); s != nil {
		if len(s.DataPoints) > 0 {
			dp := s.DataPoints[0]
			switch v := dp.Value.(type) {
			case *otlpmetricsv1.NumberDataPoint_AsDouble:
				return v.AsDouble, true
			case *otlpmetricsv1.NumberDataPoint_AsInt:
				return float64(v.AsInt), true
			}
		}
	}
	return 0, false
}

// TracesReceiver implements the OTLP TraceService gRPC server.
// It simply acknowledges incoming trace exports — traces flow through the OTel SDK
// exporter directly to the collector.
type TracesReceiver struct {
	tracesv1.UnimplementedTraceServiceServer
}

// Export acknowledges incoming trace data without processing it.
func (r *TracesReceiver) Export(ctx context.Context, req *tracesv1.ExportTraceServiceRequest) (*tracesv1.ExportTraceServiceResponse, error) {
	return &tracesv1.ExportTraceServiceResponse{}, nil
}

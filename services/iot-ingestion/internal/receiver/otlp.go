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
// one enriched TelemetryReading per device.
//
// A single iot-simulator process emits telemetry for many devices, so device
// identity is carried on each metric DATA POINT's attributes (device.id, etc.),
// not on the shared OTLP resource. We therefore group data points by device.id
// and emit one reading per device. (Resource-level attributes are still used as
// a fallback for clients that set them there.)
func (r *MetricsReceiver) Export(ctx context.Context, req *metricsv1.ExportMetricsServiceRequest) (*metricsv1.ExportMetricsServiceResponse, error) {
	ctx, span := telemetry.Tracer.Start(ctx, "otlp.metrics.receive")
	defer span.End()

	traceID := span.SpanContext().TraceID().String()

	for i, rm := range req.ResourceMetrics {
		var resAttrs []*commonv1.KeyValue
		if rm.Resource != nil {
			resAttrs = rm.Resource.Attributes
		}

		// deviceID → accumulating reading
		readings := make(map[string]*publisher.TelemetryReading)

		for _, sm := range rm.ScopeMetrics {
			for _, m := range sm.Metrics {
				for _, dp := range numberDataPoints(m) {
					deviceID := getAttrString(dp.Attributes, "device.id")
					if deviceID == "" {
						deviceID = getAttrString(resAttrs, "device.id")
					}
					if deviceID == "" {
						deviceID = fmt.Sprintf("unknown-device-%d", i)
					}

					reading, ok := readings[deviceID]
					if !ok {
						reading = &publisher.TelemetryReading{
							DeviceID:       deviceID,
							DeviceType:     firstNonEmpty(getAttrString(dp.Attributes, "device.type"), getAttrString(resAttrs, "device.type")),
							DeviceCategory: firstNonEmpty(getAttrString(dp.Attributes, "device.category"), getAttrString(resAttrs, "device.category")),
							Zone:           firstNonEmpty(getAttrString(dp.Attributes, "device.zone"), getAttrString(resAttrs, "device.zone")),
							Manufacturer:   firstNonEmpty(getAttrString(dp.Attributes, "device.manufacturer"), getAttrString(resAttrs, "device.manufacturer")),
							Timestamp:      time.Now().UTC(),
							Metrics:        make(map[string]float64),
							TraceID:        traceID,
						}
						readings[deviceID] = reading
					}

					if val, ok := dataPointValue(dp); ok {
						reading.Metrics[m.Name] = val
					}
				}
			}
		}

		for deviceID, reading := range readings {
			if !r.validator.IsKnown(deviceID) {
				log.Printf("[receiver] warning: unknown device %q — processing anyway (fail-open)", deviceID)
			}
			if err := r.publisher.Publish(ctx, reading); err != nil {
				log.Printf("[receiver] error publishing telemetry for device %q: %v", deviceID, err)
			}
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

// firstNonEmpty returns the first non-empty string of its arguments.
func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if v != "" {
			return v
		}
	}
	return ""
}

// numberDataPoints returns all numeric data points of a metric (Gauge or Sum).
func numberDataPoints(m *otlpmetricsv1.Metric) []*otlpmetricsv1.NumberDataPoint {
	if g := m.GetGauge(); g != nil {
		return g.DataPoints
	}
	if s := m.GetSum(); s != nil {
		return s.DataPoints
	}
	return nil
}

// dataPointValue pulls a float64 value from a NumberDataPoint.
// Returns (0, false) if the data point has no supported numeric value.
func dataPointValue(dp *otlpmetricsv1.NumberDataPoint) (float64, bool) {
	switch v := dp.Value.(type) {
	case *otlpmetricsv1.NumberDataPoint_AsDouble:
		return v.AsDouble, true
	case *otlpmetricsv1.NumberDataPoint_AsInt:
		return float64(v.AsInt), true
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

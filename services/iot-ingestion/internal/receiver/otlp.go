package receiver

import (
	"context"
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

// deviceReading accumulates one device's metrics across an export batch.
type deviceReading struct {
	deviceType     string
	deviceCategory string
	zone           string
	manufacturer   string
	metrics        map[string]float64
}

// Export processes an ExportMetricsServiceRequest, groups datapoints by device.id,
// and publishes one enriched TelemetryReading per device to Kafka.
//
// The iot-simulator emits a single process-level OTel resource (service.name only)
// and tags each metric DATAPOINT with device.id / device.category / device.zone, so
// device identity lives on the datapoint attributes — not the resource. We read it
// from the datapoint (falling back to resource attributes for compatibility). Reading
// only the resource — as the previous version did — collapsed every device into one
// "unknown-device-0" reading, which silently disabled per-device anomaly detection.
func (r *MetricsReceiver) Export(ctx context.Context, req *metricsv1.ExportMetricsServiceRequest) (*metricsv1.ExportMetricsServiceResponse, error) {
	ctx, span := telemetry.Tracer.Start(ctx, "otlp.metrics.receive")
	defer span.End()

	traceID := span.SpanContext().TraceID().String()

	readings := make(map[string]*deviceReading)

	for _, rm := range req.ResourceMetrics {
		var resAttrs []*commonv1.KeyValue
		if rm.Resource != nil {
			resAttrs = rm.Resource.Attributes
		}
		for _, sm := range rm.ScopeMetrics {
			for _, m := range sm.Metrics {
				for _, dp := range numberDataPoints(m) {
					val, ok := numberValue(dp)
					if !ok {
						continue
					}
					deviceID := firstNonEmpty(
						getAttrString(dp.Attributes, "device.id"),
						getAttrString(resAttrs, "device.id"),
					)
					if deviceID == "" {
						deviceID = "unknown-device"
					}
					dr := readings[deviceID]
					if dr == nil {
						dr = &deviceReading{
							deviceType:     firstNonEmpty(getAttrString(dp.Attributes, "device.type"), getAttrString(resAttrs, "device.type")),
							deviceCategory: firstNonEmpty(getAttrString(dp.Attributes, "device.category"), getAttrString(resAttrs, "device.category")),
							zone:           firstNonEmpty(getAttrString(dp.Attributes, "device.zone"), getAttrString(resAttrs, "device.zone")),
							manufacturer:   firstNonEmpty(getAttrString(dp.Attributes, "device.manufacturer"), getAttrString(resAttrs, "device.manufacturer")),
							metrics:        make(map[string]float64),
						}
						readings[deviceID] = dr
					}
					dr.metrics[m.Name] = val
				}
			}
		}
	}

	batch := make([]*publisher.TelemetryReading, 0, len(readings))
	for deviceID, dr := range readings {
		if !r.validator.IsKnown(deviceID) {
			log.Printf("[receiver] warning: unknown device %q — processing anyway (fail-open)", deviceID)
		}
		batch = append(batch, &publisher.TelemetryReading{
			DeviceID:       deviceID,
			DeviceType:     dr.deviceType,
			DeviceCategory: dr.deviceCategory,
			Zone:           dr.zone,
			Manufacturer:   dr.manufacturer,
			Timestamp:      time.Now().UTC(),
			Metrics:        dr.metrics,
			TraceID:        traceID,
		})
	}

	// One batched write per export — see Publisher.PublishBatch for why.
	if err := r.publisher.PublishBatch(ctx, batch); err != nil {
		log.Printf("[receiver] error publishing telemetry batch (%d devices): %v", len(batch), err)
	}

	return &metricsv1.ExportMetricsServiceResponse{}, nil
}

// firstNonEmpty returns the first non-empty string from vals, or "".
func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if v != "" {
			return v
		}
	}
	return ""
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

// numberDataPoints returns the NumberDataPoints of a Gauge or Sum metric.
func numberDataPoints(m *otlpmetricsv1.Metric) []*otlpmetricsv1.NumberDataPoint {
	if g := m.GetGauge(); g != nil {
		return g.DataPoints
	}
	if s := m.GetSum(); s != nil {
		return s.DataPoints
	}
	return nil
}

// numberValue extracts a float64 from a NumberDataPoint (double or int).
func numberValue(dp *otlpmetricsv1.NumberDataPoint) (float64, bool) {
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

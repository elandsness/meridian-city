package publisher

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/segmentio/kafka-go"
)

// TelemetryReading is the enriched telemetry record published to Kafka.
type TelemetryReading struct {
	DeviceID       string             `json:"device_id"`
	DeviceType     string             `json:"device_type"`
	DeviceCategory string             `json:"device_category"`
	Zone           string             `json:"zone"`
	Manufacturer   string             `json:"manufacturer"`
	Timestamp      time.Time          `json:"timestamp"`
	Metrics        map[string]float64 `json:"metrics"`
	TraceID        string             `json:"trace_id"`
}

// Publisher writes TelemetryReadings to a Kafka topic.
type Publisher struct {
	writer *kafka.Writer
}

// NewPublisher creates a Kafka publisher. brokers is a comma-separated list of
// broker addresses (e.g., "kafka:9092" or "broker1:9092,broker2:9092").
func NewPublisher(brokers, topic string) *Publisher {
	brokerList := strings.Split(brokers, ",")
	for i, b := range brokerList {
		brokerList[i] = strings.TrimSpace(b)
	}

	w := &kafka.Writer{
		Addr:         kafka.TCP(brokerList...),
		Topic:        topic,
		Balancer:     &kafka.LeastBytes{},
		RequiredAcks: kafka.RequireOne,
		Async:        false,
	}

	return &Publisher{writer: w}
}

// Publish JSON-encodes the reading and writes it to Kafka, keyed by device_id.
func (p *Publisher) Publish(ctx context.Context, reading *TelemetryReading) error {
	data, err := json.Marshal(reading)
	if err != nil {
		return fmt.Errorf("marshal telemetry: %w", err)
	}

	msg := kafka.Message{
		Key:   []byte(reading.DeviceID),
		Value: data,
	}

	if err := p.writer.WriteMessages(ctx, msg); err != nil {
		return fmt.Errorf("write kafka message: %w", err)
	}
	return nil
}

// PublishBatch writes many readings in a single WriteMessages call. The OTLP receiver
// emits one reading per device per export, so writing them one-at-a-time (each a
// synchronous, batch-timeout-bounded write) blew past the export request's context
// deadline once there were dozens of devices. Batching them into one call keeps the
// whole export well within the deadline.
func (p *Publisher) PublishBatch(ctx context.Context, readings []*TelemetryReading) error {
	if len(readings) == 0 {
		return nil
	}
	msgs := make([]kafka.Message, 0, len(readings))
	for _, reading := range readings {
		data, err := json.Marshal(reading)
		if err != nil {
			return fmt.Errorf("marshal telemetry: %w", err)
		}
		msgs = append(msgs, kafka.Message{
			Key:   []byte(reading.DeviceID),
			Value: data,
		})
	}
	if err := p.writer.WriteMessages(ctx, msgs...); err != nil {
		return fmt.Errorf("write kafka batch (%d msgs): %w", len(msgs), err)
	}
	return nil
}

// Close flushes and closes the underlying Kafka writer.
func (p *Publisher) Close() error {
	return p.writer.Close()
}

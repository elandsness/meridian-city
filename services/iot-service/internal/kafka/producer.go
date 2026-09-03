package kafka

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"github.com/confluentinc/confluent-kafka-go/v2/kafka"
)

// Producer wraps the Kafka producer for publishing telemetry and anomalies.
type Producer struct {
	producer *kafka.Producer
}

// NewProducer creates a new Kafka producer.
func NewProducer(brokers string) (*Producer, error) {
	producer, err := kafka.NewProducer(&kafka.ConfigMap{
		"bootstrap.servers": brokers,
		"client.id":         "iot-service",
		"acks":              "all",
	})
	if err != nil {
		return nil, err
	}

	return &Producer{producer: producer}, nil
}

// PublishTelemetry publishes a telemetry record to the iot.telemetry.raw topic.
func (p *Producer) PublishTelemetry(ctx context.Context, deviceID string, deviceType string, metrics map[string]float64) error {
	record := map[string]interface{}{
		"device_id":    deviceID,
		"device_type":  deviceType,
		"timestamp":    time.Now().UTC().Format(time.RFC3339),
		"metrics":      metrics,
	}

	data, err := json.Marshal(record)
	if err != nil {
		return err
	}

	deliveryChan := make(chan kafka.Event, 1)
	if err := p.producer.Produce(&kafka.Message{
		TopicPartition: kafka.TopicPartition{
			Topic:     stringPtr("iot.telemetry.raw"),
			Partition: kafka.PartitionAny,
		},
		Value: data,
		Headers: []kafka.Header{
			{Key: "device_id", Value: []byte(deviceID)},
			{Key: "device_type", Value: []byte(deviceType)},
		},
	}, deliveryChan); err != nil {
		return err
	}
	go logDeliveryResult(deliveryChan, "message")
	return nil
}

// PublishAnomaly publishes an anomaly to the iot.anomalies topic.
func (p *Producer) PublishAnomaly(ctx context.Context, deviceID string, deviceType string, metric string, value float64, threshold float64, severity string) error {
	anomaly := map[string]interface{}{
		"device_id":    deviceID,
		"device_type":  deviceType,
		"metric":       metric,
		"value":        value,
		"threshold":    threshold,
		"severity":     severity,
		"timestamp":    time.Now().UTC().Format(time.RFC3339),
	}

	data, err := json.Marshal(anomaly)
	if err != nil {
		return err
	}

	deliveryChan := make(chan kafka.Event, 1)
	if err := p.producer.Produce(&kafka.Message{
		TopicPartition: kafka.TopicPartition{
			Topic:     stringPtr("iot.anomalies"),
			Partition: kafka.PartitionAny,
		},
		Value: data,
		Headers: []kafka.Header{
			{Key: "device_id", Value: []byte(deviceID)},
			{Key: "severity", Value: []byte(severity)},
		},
	}, deliveryChan); err != nil {
		return err
	}
	go logDeliveryResult(deliveryChan, "anomaly")
	return nil
}

// Close shuts down the producer.
func (p *Producer) Close() {
	p.producer.Close()
}

func logDeliveryResult(deliveryChan chan kafka.Event, kind string) {
	e := <-deliveryChan
	if m, ok := e.(*kafka.Message); ok && m.TopicPartition.Error != nil {
		log.Printf("Failed to produce %s: %v", kind, m.TopicPartition.Error)
	}
}

func stringPtr(s string) *string {
	return &s
}

# iot-ingestion

**Language**: Go 1.22  
**Port**: gRPC 4317, HTTP 4318  
**Status**: Phase 3 — not yet implemented

## Role

High-performance OTLP receiver for IoT device telemetry. Validates, enriches, and publishes device readings to Kafka. Also forwards its own traces to the OTel Collector (Go has no OneAgent APM agent).

## Responsibilities

- Accept OTLP/gRPC from the IoT simulator on port 4317
- Validate device identity (check device registry in PostgreSQL)
- Enrich telemetry with zone, category, and city metadata
- Publish enriched events to Kafka topic `iot.telemetry.raw`
- Forward its own OTel spans to the collector for distributed trace continuity

## Kafka output format

```json
{
  "device_id": "bldg-07",
  "device_type": "building",
  "device_category": "hvac",
  "zone": "zone-north",
  "timestamp": "2025-06-04T10:30:00Z",
  "metrics": {
    "hvac_temp": 87.3,
    "hvac_setpoint": 72.0,
    "energy_kwh": 1240.5,
    "occupancy": 142
  },
  "trace_id": "abc123"
}
```

## OTel instrumentation

Uses Go OTel SDK (`go.opentelemetry.io/otel`). Creates spans for:
- OTLP message receive
- Device validation (DB lookup)
- Kafka publish

Sends to the OTel Collector (gRPC), NOT directly to Dynatrace.

## Build

```bash
go build ./...
go run ./cmd/iot-ingestion
```

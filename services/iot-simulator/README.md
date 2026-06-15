# iot-simulator

**Language**: Go 1.22  
**Port**: 8088 (admin/control HTTP API)

## Role

Simulates a dynamic fleet of IoT devices, each emitting realistic OTLP telemetry. Fleet size and anomaly states are configurable at runtime via the demo-control-api.

## Device types

| Category | Default count | Metrics emitted |
|---|---|---|
| Connected vehicles | 30 | speed, gps_lat, gps_lon, engine_temp, fuel_level, fault_codes |
| Smart buildings | 15 | hvac_temp, hvac_setpoint, energy_kwh, occupancy, co2_ppm |
| Industrial machines | 10 | vibration_mm_s, cycle_count, temp_celsius, error_rate, throughput |

## Implementation

- Each device is a goroutine. Fleet changes (add/remove) spawn or cancel goroutines.
- Two OTLP export paths:
  1. Directly to `iot-ingestion` (gRPC 4317) — the primary data path
  2. Directly to the OTel Collector — the OTel showcase path
- OTel resource attributes per device: `device.id`, `device.type`, `device.category`, `device.zone`, `device.manufacturer`

## Admin API (for demo-control-api)

- `GET /admin/fleet` — current fleet status
- `POST /admin/fleet` — resize fleet `{"vehicles": 50, "buildings": 10, "machines": 5}`
- `POST /admin/anomaly` — inject anomaly `{"device_id": "bldg-07", "type": "hvac_overtemp", "enabled": true}`
- `DELETE /admin/anomaly/{device_id}` — clear anomaly
- `GET /health`

## OTel instrumentation

Uses Go OTel SDK with OTLP/gRPC exporter. Each emitted telemetry batch is a span. Metrics are OTLP metric data points (gauges per sensor reading).

## Build

```bash
go build ./...
go run ./cmd/iot-simulator
```

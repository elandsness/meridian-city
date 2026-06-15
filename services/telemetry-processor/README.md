# telemetry-processor

**Language**: Python 3.12 / FastAPI  
**Port**: 8086 (health/status API)

## Role

Kafka consumer that processes raw IoT telemetry. Aggregates readings into 1-minute windows, stores in PostgreSQL, and detects anomalies using threshold rules.

## Responsibilities

- Consume from Kafka topic `iot.telemetry.raw`
- Compute 1-minute aggregates per device (min, max, avg, count)
- Persist aggregates to PostgreSQL `iot.device_readings`
- Evaluate anomaly thresholds per device type (see table below)
- Publish detected anomalies to `iot.anomalies`
- Emit Business Event log: `iot.anomaly_detected`

## Anomaly thresholds

| Device type | Metric | Threshold |
|---|---|---|
| Building | `hvac_temp` | > 85°C for 3 consecutive readings |
| Building | `energy_kwh` | > 2× 7-day rolling average |
| Vehicle | `engine_temp` | > 110°C |
| Vehicle | `speed` | > 120 km/h (in city zones) |
| Machine | `vibration` | > 8.0 mm/s |
| Machine | `error_rate` | > 5% |

## Fault injection

Faults are toggled at runtime via `POST /admin/fault` (called by demo-control-api), not env vars:

- `{ "kafka_pause_enabled": true }` — stops consuming from Kafka (simulates consumer lag)
- `{ "memory_pressure_enabled": true }` — allocates large buffers (simulates memory leak)
- `{ "kafka_pause_enabled": false, "memory_pressure_enabled": false }` — reset all

## Key endpoints

- `GET /health` — health check + Kafka consumer lag status
- `GET /api/v1/status` — current consumer group offsets and lag
- `POST /admin/fault` `{ kafka_pause_enabled, memory_pressure_enabled }` — runtime fault injection

## Build

```bash
pip install -r requirements.txt
python -m telemetry_processor.main    # local dev
```

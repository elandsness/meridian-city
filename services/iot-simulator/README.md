# iot-simulator

**Language**: Go 1.26
**Port**: 8088 (admin/control HTTP API)

## Role

Generic, config-driven fake IoT device fleet. Any industry config declares its
own device types under `industry.iot.deviceTypes` (type, count, metrics with
value ranges/patterns, optional log messages, optional one level of
parent/child hierarchy) -- nothing in this service is industry-specific. Each
device runs as its own goroutine, mutating its metrics on a configurable tick
and emitting OTLP metrics, logs, and trace spans directly to the shared
otel-collector. There is no separate ingestion hop and no Kafka pipeline --
Dynatrace's own AI does anomaly detection on the real telemetry. Fleet
membership and ongoing fault-gate problem injection are managed at runtime via
demo-control-api's `/api/v1/demo-control/iot/*` routes.

## Config

Reads `industry.iot` (mounted at `IOT_CONFIG_PATH`, default
`/etc/meridian/iot-config.json`, via `helm/templates/iot-config-configmap.yaml`).
See `docs/industry-config.schema.json`'s `iot`/`deviceType`/`childDeviceType`/
`deviceMetric` definitions for the full shape. Example (one device type with a
child hierarchy):

```json
{
  "enabled": true,
  "tickIntervalMs": 30000,
  "deviceTypes": [
    {
      "type": "train",
      "displayName": "Train",
      "count": 8,
      "metrics": [
        { "name": "iot.train.speed", "unit": "km/h", "min": 0, "max": 160, "pattern": "driftRandom" }
      ],
      "logs": {
        "emitProbabilityPerTick": 0.3,
        "messages": [{ "level": "info", "template": "Train {device_id} passed checkpoint" }]
      },
      "children": [
        { "type": "door", "displayName": "Door", "countPerParent": 4, "metrics": [...] }
      ]
    }
  ]
}
```

Metric `pattern` is one of: `steady` (small noise around a baseline),
`driftRandom` (bounded random walk), `cyclic` (sine wave over `periodSeconds`).

## Implementation

- `internal/config` — loads/parses the mounted JSON.
- `internal/pattern` — the three value-generation shapes above.
- `internal/faultgate` — per-device-type ongoing problem injection (same
  `{enabled, rate}` admin shape as entity-engine's `FaultGateRegistry`, plus an
  optional `metric` target and a `magnitude` describing how to push the value).
- `internal/fleet` — the device tree (parent/child via `parent_id`), spawn/
  remove, and the per-device tick loop that applies patterns + fault gates and
  emits telemetry.
- `internal/telemetry` — OTel SDK init (traces, metrics, logs) and the dynamic
  gauge/log emitters.
- `internal/admin` — the REST API below.

State is in-memory only -- a pod restart respawns the fleet fresh from config.

## Admin API (for demo-control-api)

- `GET /api/v1/iot/device-types` — configured types/metrics/hierarchy
- `GET /api/v1/iot/devices` (optional `?type=`) — list devices
- `POST /api/v1/iot/devices` `{"type": "train", "count": 1, "parent_id": ""}` — add device(s); a top-level device auto-spawns its configured children
- `DELETE /api/v1/iot/devices/{id}` — remove a device (cascades to its children)
- `GET /api/v1/iot/fault-gates` — list active fault gates by device type
- `PUT /api/v1/iot/fault-gates/{type}` `{"enabled": true, "rate": 1.0, "metric": "iot.train.brake_pressure", "magnitude": {"type": "percent", "value": -40}}` — set an ongoing, probabilistic problem
- `DELETE /api/v1/iot/fault-gates/{type}` — disable/clear a fault gate
- `GET /health`

## Build

```bash
go build ./...
go run ./cmd/iot-simulator
```

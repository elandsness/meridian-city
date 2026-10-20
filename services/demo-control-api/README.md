# demo-control-api

**Language**: Node.js 20 / Fastify  
**Port**: 3001

## Role

Internal REST API that powers the Demo Control Panel in the ops dashboard. Orchestrates fault injection, IoT device fleet management, and scenario triggers.

## Responsibilities

- **Fault injection**: Calls each service's internal `/admin/fault` endpoint to enable/disable failures
- **IoT fleet management**: Calls `iot-simulator`'s admin API to add/remove devices and toggle ongoing fault gates
- **Traffic control**: Calls `traffic-bot` admin API to start, stop, or trigger burst
- **Scenario presets**: Orchestrates multi-service failures for named scenarios (e.g., "Cascade Failure")
- Maintains current state so the ops dashboard can show what's active

## How fault injection works

Faults are injected purely over HTTP — demo-control-api calls each target service's
internal `/admin/fault` endpoint. There is no Kubernetes API access: it does not patch
Deployments or ConfigMaps and needs no RBAC.

## Key endpoints

### Fault injection
- `GET /api/v1/fault/status` — current fault state across all services
- `POST /api/v1/fault/:service` — inject a fault into a specific service; body varies by service:
  - `citizen-service` / `city-operations` — `{ "db_slowdown_enabled": true, "db_slowdown_seconds": 2 }`
  - `analytics-service` — `{ "db_slowdown_enabled": true, "db_slowdown_seconds": 2, "memory_pressure_enabled": true }`
  - `ai-service` — `{ "llm_latency_enabled": true, "llm_latency_seconds": 10 }`
- `POST /api/v1/fault/reset-all` — clear all active faults

### IoT device fleet
- `GET /api/v1/iot/device-types` — configured device types, metrics, and hierarchy
- `GET /api/v1/iot/devices` (optional `?type=`) — list devices
- `POST /api/v1/iot/devices` `{ "type": "train", "count": 1, "parent_id": "" }` — add device(s); a top-level device auto-spawns its configured children
- `DELETE /api/v1/iot/devices/:id` — remove a device (cascades to its children)
- `GET /api/v1/iot/fault-gates` — list active fault gates by device type
- `PUT /api/v1/iot/fault-gates/:type` `{ "enabled": true, "rate": 1.0, "metric": "iot.train.brake_pressure", "magnitude": { "type": "percent", "value": -40 } }` — set an ongoing, probabilistic problem
- `DELETE /api/v1/iot/fault-gates/:type` — disable/clear a fault gate

### Traffic control
- `GET /api/v1/traffic/status`
- `POST /api/v1/traffic/start`
- `POST /api/v1/traffic/stop`
- `POST /api/v1/traffic/burst`
- `POST /api/v1/traffic/scenario` `{ "scenario": "<name>" }`

### Scenarios
- `GET /api/v1/scenarios` — list all available scenarios
- `GET /api/v1/scenarios/active` — currently active scenario (if any)
- `POST /api/v1/scenarios/:id/start` — activate a scenario
- `DELETE /api/v1/scenarios/active` — reset active scenario + clear all faults
- `POST /api/v1/scenarios/reset-all` — reset all scenarios + faults + IoT fault gates

## Build

```bash
npm install
npm run dev
```

# demo-control-api

**Language**: Node.js 20 / Fastify  
**Port**: 3001

## Role

Internal REST API that powers the Demo Control Panel in the ops dashboard. Orchestrates fault injection, fleet management, and scenario triggers.

## Responsibilities

- **Fault injection**: Calls each service's internal `/admin/fault` endpoint to enable/disable failures
- **Fleet management**: Calls `iot-simulator` admin API to resize the device fleet
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
  - `telemetry-processor` — `{ "memory_pressure_enabled": true }`
  - `ai-service` — `{ "llm_latency_enabled": true, "llm_latency_seconds": 10 }`
- `POST /api/v1/fault/reset-all` — clear all active faults

### Fleet management
- `GET /api/v1/fleet/status` — current fleet counts + active anomalies
- `POST /api/v1/fleet/resize` `{ "vehicles": 30, "buildings": 15, "machines": 10 }`
- `POST /api/v1/fleet/anomaly` `{ "category": "buildings", "device_id": "bldg-07", "anomaly_type": "hvac_overtemp" }`
- `DELETE /api/v1/fleet/anomaly` — clear all active device anomalies

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
- `POST /api/v1/scenarios/reset-all` — reset all scenarios + faults + IoT anomalies

## Build

```bash
npm install
npm run dev
```

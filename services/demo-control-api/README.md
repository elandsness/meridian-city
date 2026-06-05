# demo-control-api

**Language**: Node.js 20 / Fastify  
**Port**: 3001  
**Status**: Phase 5 — not yet implemented

## Role

Internal REST API that powers the Demo Control Panel in the ops dashboard. Orchestrates fault injection, fleet management, and scenario triggers.

## Responsibilities

- **Fault injection**: Calls each service's internal `/admin/fault` endpoint to enable/disable failures
- **Fleet management**: Calls `iot-simulator` admin API to resize the device fleet
- **Traffic control**: Calls `traffic-bot` admin API to pause, resume, or trigger burst
- **Scenario presets**: Orchestrates multi-service failures for named scenarios (e.g., "Cascade Failure")
- Maintains current state so the ops dashboard can show what's active

## Requires

Kubernetes RBAC: the demo-control-api ServiceAccount has `patch` access to Deployments and ConfigMaps in the `meridian` namespace. This allows it to update fault injection flags directly in running containers without a full redeploy.

## Key endpoints

### Fault injection
- `POST /api/v1/faults/db-slowdown` `{ "enabled": true, "delayMs": 2000 }`
- `POST /api/v1/faults/memory-pressure` `{ "enabled": true }`
- `POST /api/v1/faults/cpu-spike` `{ "enabled": true }`
- `POST /api/v1/faults/kafka-pause` `{ "enabled": true }`
- `POST /api/v1/faults/llm-latency` `{ "enabled": true, "delaySeconds": 10 }`
- `POST /api/v1/faults/cascade` — triggers DB slowdown + Kafka pause simultaneously
- `DELETE /api/v1/faults` — reset all active faults

### Fleet management
- `GET /api/v1/fleet` — current fleet configuration
- `PUT /api/v1/fleet` `{ "vehicles": 30, "buildings": 15, "machines": 10 }`
- `POST /api/v1/fleet/anomaly` `{ "device_id": "bldg-07", "type": "hvac_overtemp" }`
- `DELETE /api/v1/fleet/anomaly/{device_id}`

### Traffic control
- `POST /api/v1/traffic/pause`
- `POST /api/v1/traffic/resume`
- `POST /api/v1/traffic/burst`

### State
- `GET /api/v1/status` — all active faults, fleet config, traffic state

## Build

```bash
npm install
npm run dev
```

# city-operations

**Language**: Java 21 / Spring Boot 3  
**Port**: 8083  
**Status**: Phase 2 — not yet implemented

## Role

The city's asset registry and operational hub. Manages buildings, vehicles, industrial zones, work orders, and incidents. The downstream target for both service requests and IoT anomalies.

## Responsibilities

- City asset CRUD (buildings, vehicles, zones, machines)
- Work order management (create, assign, update, resolve)
- Incident management (IoT anomaly → incident → work order)
- Kafka consumer: `iot.anomalies`, `requests.events`
- Kafka producer: `notifications.outbound`
- Business Event log emission for work order and request lifecycle

## Business Events emitted

| `event.type` | Trigger |
|---|---|
| `service_request.in_progress` | Work started on request |
| `service_request.resolved` | Request resolved |
| `incident.created` | New incident from IoT anomaly |
| `workorder.created` | Work order created |
| `workorder.assigned` | Work order assigned to technician |
| `workorder.acknowledged` | Technician acknowledged |
| `workorder.resolved` | Work order completed |

## Fault injection

Supports runtime fault injection via environment variables (set by demo-control-api):

| Env var | Type | Effect |
|---|---|---|
| `FAULT_DB_SLOWDOWN_ENABLED` | bool | Adds artificial delay to all JDBC calls |
| `FAULT_DB_SLOWDOWN_DELAY_MS` | int | Delay in ms (default 2000) |
| `FAULT_CPU_SPIKE_ENABLED` | bool | Runs a CPU-intensive computation in a background thread |

## Key endpoints

- `GET /api/v1/assets` — list all city assets
- `GET /api/v1/buildings` — list buildings with IoT status
- `GET /api/v1/incidents` — active incidents
- `POST /api/v1/work-orders` — create work order
- `POST /admin/fault` — runtime fault injection (internal, not proxied)
- `GET /actuator/health`

## Build

```bash
mvn clean package
mvn spring-boot:run
```

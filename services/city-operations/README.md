# city-operations

**Language**: Java 21 / Spring Boot 3  
**Port**: 8083

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

Faults are toggled at runtime via `POST /admin/fault` (called by demo-control-api).
Body:

```json
{ "type": "db-slowdown" | "cpu-spike", "enabled": true, "delayMs": 2000 }
```

- `db-slowdown` — adds artificial delay (`delayMs`) to JDBC calls
- `cpu-spike` — runs a CPU-intensive computation in a background thread (`delayMs` ignored)

The initial state can also be seeded at startup via env vars
(`FAULT_DB_SLOWDOWN_ENABLED`, `FAULT_DB_SLOWDOWN_DELAY_MS`, `FAULT_CPU_SPIKE_ENABLED`;
defaults off, delay 0).

## Key endpoints

- `GET /api/v1/assets` — list all city assets
- `GET /api/v1/city/buildings` — list buildings with IoT status
- `GET /api/v1/incidents` — active incidents
- `POST /api/v1/work-orders` — create work order
- `POST /admin/fault` `{ type, enabled, delayMs }` — runtime fault injection (internal, not proxied)
- `GET /actuator/health`

## Build

```bash
mvn clean package
mvn spring-boot:run
```

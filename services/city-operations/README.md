# city-operations

**Language**: Java 21 / Spring Boot 3  
**Port**: 8083

## Role

The city's asset registry and operational hub. Manages buildings, vehicles, industrial zones, work orders, and incidents. The downstream target for both service requests and IoT anomalies.

## Responsibilities

- City asset CRUD (buildings, vehicles, zones, machines)
- Work order management (create, assign, update, resolve)
- Incident management (IoT anomaly → incident → work order)
- Kafka consumer: `iot.anomalies`
- Kafka producer: `notifications.outbound`
- Business Event log emission for work order and request lifecycle

## Business Events emitted

| `event.type` | Trigger |
|---|---|
| `iot.anomaly_detected` | IoT anomaly consumed from Kafka |
| `incident.created` | New incident from an IoT anomaly |
| `workorder.created` | Work order created |

## Key endpoints

- `GET /api/v1/assets` — list all city assets
- `GET /api/v1/city/buildings` — list buildings with IoT status
- `GET /api/v1/incidents` — active incidents
- `POST /api/v1/work-orders` — create work order
- `GET /actuator/health`

## Build

```bash
mvn clean package
mvn spring-boot:run
```

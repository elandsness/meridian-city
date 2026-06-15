# service-dispatch

**Language**: Java 21 / Spring Boot 3  
**Port**: 8082

## Role

Routes and assigns service requests to the appropriate city department based on category, priority, and zone. Part of the Business Events flow chain.

## Responsibilities

- Consume new requests from citizen-service (via synchronous HTTP call from api-gateway)
- Apply routing logic: map request category + zone → city department
- Assign priority SLA deadlines
- Update request status and emit Business Event log lines
- Call city-operations to create the work order

## Business Events emitted

| `event.type` | Trigger |
|---|---|
| `service_request.dispatched` | Routing decision made |
| `service_request.assigned` | Assigned to a specific department/person |

## Routing logic

| Category | Department |
|---|---|
| `infrastructure` | Infrastructure Maintenance |
| `utilities` | Utilities Operations |
| `parks` | Parks and Recreation |
| `permits` | Permits Office |
| `sanitation` | Sanitation Services |

## Key endpoints

- `POST /api/v1/dispatch` — dispatch a service request (called by api-gateway)
- `GET /actuator/health`

## Dynatrace instrumentation

OneAgent auto-instrumentation. Downstream HTTP call to city-operations is captured in the trace automatically — no manual propagation needed.

## Build

```bash
mvn clean package
mvn spring-boot:run
```

# citizen-service

**Language**: Java 21 / Spring Boot 3  
**Port**: 8081

## Role

Manages citizen accounts and service request submissions. The primary Business Events source for the citizen-facing business flows.

## Responsibilities

- Citizen registration and profile management
- Credential verification (email + BCrypt password) backing the gateway login dispatcher
- Service request CRUD (submit, retrieve, update status)
- Emits structured Business Event logs at each request lifecycle step
- Publishes to Kafka topic `requests.events`

## Business Events emitted

| `event.type` | Trigger |
|---|---|
| `account.registration_started` | Citizen begins registration form |
| `account.details_submitted` | Form submitted |
| `account.verification_sent` | Verification email "sent" (mock) |
| `account.verified` | Citizen clicks verify |
| `account.activated` | Account fully active |
| `service_request.submitted` | New request received |
| `service_request.validated` | Request passes validation |

## Key endpoints

- `POST /api/v1/citizens` — register citizen. Accepts an optional `password`; when present a
  login account (BCrypt-hashed) is created so the citizen can log in by email.
- `POST /api/v1/auth/login` — verifies `{ email, password }` against `citizens.accounts`
  (BCrypt). Called internally by the api-gateway login dispatcher, not exposed directly
  through the gateway. Returns the citizen identity on success, `401` otherwise.
- `POST /api/v1/service-requests` — submit request
- `GET /api/v1/service-requests/{id}` — get request status
- `GET /api/v1/service-requests?citizen_id=&limit=` — list requests; both params optional.
  Omit `citizen_id` to get the most recent requests across all citizens (`limit` defaults to 50).
- `POST /admin/fault` `{ "db_slowdown_enabled": true, "db_slowdown_seconds": 2 }` — runtime
  fault injection, called by demo-control-api. Not under `/api/v1`, so not exposed through the gateway.
- `GET /actuator/health` — Spring Boot health endpoint

## Dynatrace instrumentation

OneAgent auto-instrumentation. Spring Boot, JDBC, Kafka producer all auto-captured.

## Build

```bash
mvn clean package
mvn spring-boot:run    # local dev
```

## Structured log format

All business event logs follow this schema for Dynatrace Business Events extraction:
```json
{
  "timestamp": "ISO-8601",
  "level": "INFO",
  "service": "citizen-service",
  "event.type": "<event-type>",
  "citizen.id": "<uuid>",
  "request.id": "<uuid>",
  "trace.id": "<otel-trace-id>"
}
```

# Meridian City Platform — Architecture

## Overview

Meridian is a polyglot microservices application deliberately built across four languages to demonstrate Dynatrace's ability to observe heterogeneous stacks with no code changes (OneAgent) and to showcase its OpenTelemetry ingestion capabilities.

---

## Service Map

```
                ┌──────────────────────────────────┐
                │    Public City Portal (React)     │
                │    Citizen-facing: maps,          │
                │    service requests, AI chatbot   │
                └──────────┬───────────────────────┘
                           │ HTTP
                ┌──────────────────────────────────┐
                │    Ops Dashboard (React)          │
                │    Ops view + Demo Control Panel  │
                └──────────┬───────────────────────┘
                           │ HTTP
                           ▼
             ┌─────────────────────────┐
             │      API Gateway        │   Node.js / Fastify
             │  Routes all traffic     │   Port: 3000
             │  Mock auth middleware   │
             └──┬────────┬──────┬──────┘
                │        │      │
         ┌──────┘   ┌────┘   ┌──┘
         ▼          ▼        ▼
 ┌─────────────┐ ┌──────────┐ ┌──────────────┐ ┌──────────────┐
 │  Citizen    │ │ Service  │ │    City      │ │  AI Service  │
 │  Service    │ │ Dispatch │ │  Operations  │ │  (chatbot)   │
 │  Java/SB    │ │ Java/SB  │ │  Java/SB     │ │  Python/FAST │
 │  Port: 8081 │ │ Port:8082│ │  Port: 8083  │ │  Port: 8085  │
 └──────┬──────┘ └────┬─────┘ └──────┬───────┘ └──────┬───────┘
        │             │              │                 │ OTLP
        └─────────────┼──────────────┘                 ▼
                      │                         ┌──────────────┐
                      ▼                         │   LLM API    │
                ┌──────────┐                    │  OpenAI /    │
                │PostgreSQL│                    │  Anthropic / │
                │(primary  │                    │  Ollama      │
                │ database)│                    └──────────────┘
                └──────────┘
        ┌────────────────────────────────────────────────────┐
        │                   Analytics Services               │
        │  ┌─────────────┐        ┌────────────────────┐    │
        │  │  Analytics  │        │  Notification Svc  │    │
        │  │  Service    │        │  Node.js / Express │    │
        │  │  Python/FAST│        │  Port: 8087        │    │
        │  │  Port: 8084 │        └──────────┬─────────┘    │
        │  └─────────────┘                   │              │
        └────────────────────────────────────┼──────────────┘
                                             │ Kafka (consumer)
        ┌────────────────────────────────────┼──────────────┐
        │                   IoT Pipeline     │              │
        │                                   │              │
        │  ┌──────────────┐ OTLP ┌──────────┴───┐ Kafka    │
        │  │ IoT Simulator│─────▶│IoT Ingestion │──────────┤
        │  │  Go          │      │  Go          │          │
        │  │  (goroutines)│      │  Port: 4317  │          ▼
        │  └──────┬───────┘      └──────────────┘  ┌──────────────┐
        │         │                                 │  Telemetry   │
        │         │ OTLP (direct to collector)      │  Processor   │
        │         ▼                                 │  Python/FAST │
        │  ┌──────────────────┐                     │  Port: 8086  │
        │  │  OTel Collector  │◀────────────────────┘              │
        │  │  (all OTel data) │                                     │
        │  └────────┬─────────┘                                     │
        │           │                                               │
        └───────────┼───────────────────────────────────────────────┘
                    ▼
           Dynatrace SaaS
```

---

## Services Reference

### API Gateway
- **Language**: Node.js 20 / Fastify
- **Port**: 3000
- **Role**: Single ingress for all frontend HTTP traffic. Handles mock authentication (validates `demo`/`dynatrace` credentials and issues a short-lived JWT for the ops dashboard), and proxies requests to downstream services. Adds `x-request-id` and `x-trace-id` headers for correlation.
- **Instrumentation**: OneAgent (auto)
- **Key upstream services**: All 4 core Java/Python services

### Citizen Service
- **Language**: Java 21 / Spring Boot 3
- **Port**: 8081
- **Role**: Citizen account lifecycle (register, login, profile). Service request submission and retrieval. **Business Events source** — emits structured JSON logs for `account.*` and `service_request.submitted/validated` events.
- **Instrumentation**: OneAgent (auto) — full Spring Boot auto-instrumentation including SQL, HTTP, Kafka
- **Database**: PostgreSQL schemas: `citizens`, `requests`
- **Kafka**: Producer on `requests.events`

### Service Dispatch
- **Language**: Java 21 / Spring Boot 3
- **Port**: 8082
- **Role**: Routes submitted service requests to the appropriate city department. Applies priority logic, SLA rules, and geographic zone routing. **Business Events source** for `service_request.dispatched/assigned`.
- **Instrumentation**: OneAgent (auto)
- **Database**: PostgreSQL schema: `requests`
- **Kafka**: Producer on `requests.events`; consumer/producer for dispatch workflow

### City Operations
- **Language**: Java 21 / Spring Boot 3
- **Port**: 8083
- **Role**: City asset registry (buildings, vehicles, industrial zones). Work order management. Incident creation from IoT anomalies. **Business Events source** for `service_request.in_progress/resolved` and `workorder.*`.
- **Instrumentation**: OneAgent (auto). **Fault injection**: DB slowdown and CPU spike are injectable via environment variables updated by `demo-control-api`.
- **Database**: PostgreSQL schemas: `city`, `incidents`
- **Kafka**: Consumer on `iot.anomalies`, `requests.events`; producer on `notifications.outbound`

### Analytics Service
- **Language**: Python 3.12 / FastAPI
- **Port**: 8084
- **Role**: Computes KPIs for the ops dashboard (requests per hour, resolution rate, anomaly counts). Provides the `/metrics` endpoint read by Dynatrace Site Reliability Guardian for SLO evaluation.
- **Instrumentation**: OneAgent (auto)
- **Database**: PostgreSQL schema: `analytics` (reads from all other schemas)

### AI Service
- **Language**: Python 3.12 / FastAPI
- **Port**: 8085
- **Role**: Citizen chatbot ("Ask the City Assistant"). Accepts a citizen message, optionally queries `citizen-service` and `city-operations` for context, builds a prompt, and calls the configured LLM. Returns the response with source citations.
- **Instrumentation**: **OTel SDK** (Python) using GenAI semantic conventions. Emits spans with `gen_ai.system`, `gen_ai.request.model`, `gen_ai.usage.prompt_tokens`, `gen_ai.usage.completion_tokens`. Flows through OTel Collector to Dynatrace AI Observability.
- **LLM provider**: Configurable via `LLM_PROVIDER` env var (`openai` | `anthropic` | `local`)

### IoT Ingestion
- **Language**: Go 1.22
- **Port**: gRPC 4317, HTTP 4318
- **Role**: OTLP/gRPC receiver for IoT device telemetry from the simulator. Validates device identity, enriches with zone/category metadata, and publishes to Kafka `iot.telemetry.raw`. Also mirrors OTel spans to the OTel Collector.
- **Instrumentation**: **OTel SDK** (Go) — Go has no OneAgent APM agent. Go OTel SDK is used for self-instrumentation.

### Telemetry Processor
- **Language**: Python 3.12 / FastAPI
- **Port**: 8086 (health/status endpoint)
- **Role**: Kafka consumer on `iot.telemetry.raw`. Aggregates device readings into 1-minute windows, stores in PostgreSQL `iot` schema. Runs simple threshold-based anomaly detection; publishes detected anomalies to `iot.anomalies`. **Fault injection**: Kafka pause and memory pressure are injectable.
- **Instrumentation**: OneAgent (auto) for the FastAPI component; OTel SDK for Kafka consumer spans

### Notification Service
- **Language**: Node.js 20 / Express
- **Port**: 8087
- **Role**: Kafka consumer on `notifications.outbound` and `iot.anomalies`. Stores in-app notifications in an in-memory store (no external dependency) served to the ops dashboard via SSE (Server-Sent Events).
- **Instrumentation**: OneAgent (auto)

### Demo Control API
- **Language**: Node.js 20 / Fastify
- **Port**: 3001
- **Role**: Internal REST API for the demo control panel. Triggers fault injection (updates ConfigMaps or calls service-specific `/admin/fault` endpoints), resizes the IoT fleet (calls `iot-simulator` admin endpoint), and controls the traffic bot. Requires cluster RBAC to patch Deployments.
- **Instrumentation**: OneAgent (auto)

### IoT Simulator
- **Language**: Go 1.22
- **Port**: 8088 (admin/control API)
- **Role**: Simulates a dynamic fleet of IoT devices. Each device runs as a goroutine emitting OTLP metrics + traces on a configurable interval. Devices emit to `iot-ingestion` (gRPC) and to the OTel Collector (direct path for the OTel showcase). Fleet size and anomaly states are configurable at runtime via the admin API.
- **Instrumentation**: **OTel SDK** (Go). Resource attributes include `device.type`, `device.id`, `device.category`, `device.zone`.

### Traffic Bot
- **Language**: Node.js 20
- **Port**: 8089 (health/control)
- **Role**: Drives realistic citizen user journeys against the API gateway. Simulates browsing, account creation, service request submission, and chatbot interactions at a configurable rate. Runs the four journey types on weighted random schedules to produce realistic traffic patterns.
- **Instrumentation**: None (it is the load driver, not a subject of observation)

---

## Data Architecture

### PostgreSQL Schema Layout

```
meridian (database)
├── citizens
│   ├── citizens          Citizen profiles (name, email, zone)
│   ├── accounts          Login credentials (mock, hashed)
│   └── sessions          Active session tokens
├── requests
│   ├── service_requests  Request submissions
│   └── request_events    State transition events (for Business Events)
├── city
│   ├── assets            Generic city asset registry
│   ├── buildings         Building-specific metadata
│   ├── vehicles          Vehicle fleet
│   └── zones             Geographic zones (GeoJSON)
├── incidents
│   ├── incidents         Active/resolved operational incidents
│   └── work_orders       Field work orders
├── iot
│   ├── devices           Known device registry
│   ├── device_readings   IoT telemetry aggregates (1-min windows)
│   └── anomalies         Detected anomaly events
└── analytics
    ├── kpi_snapshots     Hourly KPI rollups
    └── business_event_log Structured event log (for BizEvents)
```

### Kafka Topics

| Topic | Partitions | Retention | Producer → Consumer |
|---|---|---|---|
| `iot.telemetry.raw` | 3 | 24h | iot-ingestion → telemetry-processor |
| `iot.anomalies` | 1 | 24h | telemetry-processor → notification-service, city-operations |
| `requests.events` | 2 | 7d | citizen-service, service-dispatch → notification-service, analytics-service |
| `notifications.outbound` | 1 | 1h | city-operations → notification-service |

---

## Dynatrace Instrumentation Strategy

### OneAgent (automatic, no code changes)

The Dynatrace Operator deploys OneAgent as a k8s init container into every pod in the `meridian` namespace (enabled via the `dynatrace.com/inject=true` namespace label). OneAgent automatically instruments:

- Java services (Spring Boot): full APM — SQL traces, HTTP spans, Kafka producer/consumer spans, JVM metrics
- Node.js services (Fastify, Express): HTTP spans, library traces, process metrics
- Python services (FastAPI): HTTP spans, library traces, process metrics

### OTel SDK (explicit, code-level instrumentation)

Used where OneAgent does not have APM support (Go) and where deeper semantic metadata is needed (AI observability):

| Service | SDK | Reason |
|---|---|---|
| `iot-ingestion` | Go OTel SDK | No OneAgent Go APM |
| `iot-simulator` | Go OTel SDK | IoT device simulation uses OTel semantic conventions |
| `ai-service` | Python OTel SDK | OTel GenAI semantic conventions for AI Observability |

OTel telemetry from all three services flows through the OTel Collector to Dynatrace.

### Business Events (log extraction)

All Java services (citizen-service, service-dispatch, city-operations) emit JSON-structured log lines at key business process steps. Dynatrace Business Events are configured to extract these into the analytics stream using log processing rules (no application code change required — pure DT tenant configuration).

Example log event:
```json
{
  "timestamp": "2025-06-04T10:30:00.123Z",
  "level": "INFO",
  "logger": "com.meridian.citizen.domain.ServiceRequestService",
  "event.type": "service_request.submitted",
  "request.id": "req-00456",
  "citizen.id": "cit-00123",
  "request.category": "infrastructure",
  "request.priority": "normal",
  "trace.id": "abc123def456"
}
```

---

## Demo Control Architecture

The `demo-control-api` service acts as an operator for fault injection:

1. **Service-level fault injection**: Calls each service's internal `/admin/fault` endpoint (e.g., `POST /admin/fault { "type": "db-slowdown", "enabled": true, "delayMs": 2000 }`). Each service checks a thread-local or in-memory flag and artificially delays or errors.

2. **Fleet resize**: Calls `iot-simulator`'s admin endpoint (`POST /admin/fleet { "vehicles": 50 }`). The simulator dynamically starts or stops goroutines.

3. **Traffic control**: Calls `traffic-bot`'s admin endpoint to pause, resume, or trigger burst patterns.

The ops dashboard calls `demo-control-api` from the browser — `api-gateway` proxies these calls through to avoid CORS issues.

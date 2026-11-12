# Meridian Demo Platform — Architecture

## Overview

Meridian is a polyglot, config-driven demo platform. A single backend — a
generic **entity engine** with no domain knowledge compiled in — is re-skinned
per industry by a declarative `values-<industry>.yaml` overlay. The platform is
built across four languages deliberately, to demonstrate Dynatrace's ability to
observe heterogeneous stacks with no code changes (OneAgent) alongside its
OpenTelemetry ingestion capabilities.

This document describes the **current, generic architecture**. For how an
industry config turns into the screens, entities, and Business Flows you see
at runtime, see [authoring-kit/README.md](authoring-kit/README.md). If you're
looking for the pre-rewrite architecture (fixed `citizen-service` /
`service-dispatch` / `city-operations`, one Postgres table per entity type),
that no longer exists — see the [breaking-change notice](../README.md#-breaking-change--read-before-touching-an-existing-deployment-or-config)
in the README.

---

## Service Map

```
                ┌──────────────────────────────────┐
                │   Public Portal (React)           │
                │   Skinned per-industry: entity    │
                │   screens, AI chatbot, home modules│
                └──────────┬────────────────────────┘
                           │ HTTP
                ┌──────────────────────────────────┐
                │   Ops Dashboard (React)            │
                │   Command Center + Demo Control    │
                └──────────┬────────────────────────┘
                           │ HTTP
                           ▼
             ┌─────────────────────────┐
             │      API Gateway        │   Node.js / Fastify
             │  Routes all traffic     │   Port: 3000
             │  JWT auth dispatcher    │
             └──┬────┬─────┬─────┬─────┬─────┬────┬────┘
                │    │     │     │     │     │    │
         ┌──────┘ ┌──┘  ┌──┘  ┌──┘  ┌──┘  ┌──┘    └──┐
         ▼        ▼     ▼     ▼     ▼     ▼           ▼
   ┌──────────┐┌──────┐┌────────┐┌─────────┐┌───────┐┌──────────┐
   │ Customer-││ Ops- ││Identity││Workflow ││Journey││Transaction│
   │ Entity   ││Entity││Service ││Service  ││Service││Service    │
   │ Service* ││Svc*  ││Java/SB ││Java/SB  ││Java/SB││Java/SB    │
   │8094      ││8094  ││8081    ││8083     ││8093   ││8090       │
   └────┬─────┘└──┬───┘└───┬────┘└────┬────┘└───┬───┘└─────┬────┘
        │         │        │          │         │          │
        └─────────┴────────┴──────────┴─────────┴──────────┘
                           │
                           ▼
                     ┌──────────┐        ┌──────────────┐
                     │PostgreSQL│        │ Routing Svc  │  Java/SB — dispatch
                     │entities. │        │ Port: 8095   │  logic for
                     │entity +  │        └──────────────┘  customer-entity-svc
                     │entity_   │
                     │event     │        ┌──────────────┐
                     └──────────┘        │  AI Service  │  Python/FastAPI
                                          │  Port: 8085  │  chatbot
                                          └──────┬───────┘
                                                 │ OTLP (GenAI spans)
                                                 ▼
                                          ┌──────────────┐
                                          │   LLM API    │
                                          │  OpenAI /    │
                                          │  Anthropic / │
                                          │  Ollama      │
                                          └──────────────┘

        ┌────────────────────────────────────────────────────┐
        │              Analytics & Ambient Services           │
        │  Analytics Svc (Py, 8084)   Notification Svc (Node, 8087) │
        │  News Ticker Svc (Node, 8095)   Weather Svc (Node, 8096)  │
        └───────────────────────────────┬──────────────────────┘
                                         │ Kafka (consumer)
        ┌────────────────────────────────┼──────────────────────┐
        │                      IoT & Movement                   │
        │  IoT Simulator (Go, 8088)   Movement Service (Go, 8095)│
        │  Both emit OTLP metrics/logs/traces directly          │
        │  to the collector — no Kafka hop for telemetry         │
        └────────────────────────────────┬──────────────────────┘
                                         │
                                         ▼
                                ┌──────────────────┐
                                │  OTel Collector   │  (OTLP gRPC 4317 / HTTP 4318)
                                └─────────┬─────────┘
                                          ▼
                                   Dynatrace SaaS

        ┌────────────────────────────────────────────────────┐
        │   Demo Control API (Node, 3001) — fault injection,  │
        │   IoT fleet mgmt, traffic control. No k8s API/RBAC. │
        │   Traffic Bot (Node, 8089) — synthetic load driver. │
        └────────────────────────────────────────────────────┘
```
*`customer-entity-service` and `ops-entity-service` are the **same**
`entity-engine` image, deployed twice with different `SERVICE_ROLE`/`domain`
scoping. A third, undivided `entity-engine` deployment exists in the chart for
backward compatibility but is disabled by default (`entityEngine.enabled: false`).

---

## Services Reference

### API Gateway
- **Language**: Node.js 20 / Fastify
- **Port**: 3000
- **Role**: Single ingress for all frontend HTTP traffic. `/api/v1/auth/login` is a dispatcher — `demo`/`dynatrace` returns an operator JWT; any other username is treated as a customer email and verified against identity-service, returning a JWT carrying the customer id. Proxies all other `/api/v1/*` to downstream services by prefix (only `/api/v1/demo-control/*` is rewritten). Adds `x-request-id` for correlation. Re-serializes proxied JSON bodies before forwarding to `undici` — required or every proxied POST/PUT/PATCH 502s.
- **Instrumentation**: OneAgent (auto)

### Entity Engine — `customer-entity-service` / `ops-entity-service`
- **Language**: Java 21 / Spring Boot 3
- **Port**: 8094 (both)
- **Role**: The generic, config-driven core of the platform. One codebase, deployed twice against the same `entity-config` ConfigMap (rendered from the active industry's `industry.entities` block): `customer-entity-service` (`SERVICE_ROLE`/`domain: customer`) owns customer-facing entity types; `ops-entity-service` (`domain: ops`) owns ops-facing ones. Each only generates/advances the entity types whose `domain` matches its own role — an entity with no `domain` set is never picked up by either. Entities are stored in one polymorphic table (`entities.entity`), not one table per type — see [Data Architecture](#data-architecture) below. Every state transition can emit a structured signal (**Business Events source**).
- **Instrumentation**: OneAgent (auto) — full Spring Boot auto-instrumentation including SQL, HTTP, Kafka
- **Database**: PostgreSQL schema `entities` (`entity`, `entity_event`)
- **Key integrations**: `routing-service` (customer-entity-service's dispatch calls), `ops-entity-service` (linked work-order creation)

### Identity Service
- **Language**: Java 21 / Spring Boot 3
- **Port**: 8081
- **Role**: Generic identity/account domain — registration (optionally with a password → BCrypt login account), credential verification (called by the gateway's auth dispatcher). **Business Events source** for `citizen.registered` and account lifecycle events.
- **Instrumentation**: OneAgent (auto)
- **Kafka**: Producer on `identity.events`

### Workflow Service
- **Language**: Java 21 / Spring Boot 3
- **Port**: 8083
- **Role**: Generic workflow domain — service requests, work orders, incidents, and asset registry. Replaces what used to be split across `service-dispatch` and `city-operations`. Applies dispatch rules and priority/SLA logic; creates incidents from IoT anomalies (via Kafka), manual submission, or the semantic seeder. **Business Events source**.
- **Instrumentation**: OneAgent (auto)
- **Kafka**: Producer/consumer on `workflow.events`; consumer on `iot.anomalies`

### Transaction Service
- **Language**: Java 21 / Spring Boot 3
- **Port**: 8090
- **Role**: Generic transaction domain — carts, orders, bills, and payments (replaces the old commerce/billing split). **Business Events source** for checkout and payment flows.
- **Instrumentation**: OneAgent (auto)
- **Kafka**: Producer/consumer on `transaction.events`

### Journey Service
- **Language**: Java 21 / Spring Boot 3
- **Port**: 8093
- **Role**: Dedicated lifecycle engine for a continuously-moving fleet (trucks between hubs, ground vehicles, ships between ports) — the reserved `entityType: journey`. Off by default (`journeyService.enabled: false`); an industry config that needs a moving-fleet map turns it on and supplies `generator.routes`. Status progression (`initiated` → `in_progress` → `completed`) is fixed platform-wide, not configurable per industry.
- **Instrumentation**: OneAgent (auto)
- **Kafka**: Producer/consumer on `journey.events`

### Routing Service
- **Language**: Java 21 / Spring Boot 3
- **Port**: 8095
- **Role**: Dispatch/routing logic invoked by `customer-entity-service` — maps a request's category to the right department/team, per the industry config's `routing:` block.
- **Instrumentation**: OneAgent (auto)

### Analytics Service
- **Language**: Python 3.12 / FastAPI
- **Port**: 8084
- **Role**: Computes KPIs for the ops dashboard and the `/metrics` endpoint read by Dynatrace Site Reliability Guardian for SLO evaluation. Flow/funnel definitions come from the industry config's `analytics.flows`.
- **Instrumentation**: OneAgent (auto); OTel SDK spans for request paths OneAgent's Python `applicationMonitoring` doesn't fully cover

### AI Service
- **Language**: Python 3.12 / FastAPI
- **Port**: 8085
- **Role**: The configurable-LLM chatbot. Accepts a message, optionally queries entity services for context, builds a prompt, and calls the configured LLM. Returns the response with source citations.
- **Instrumentation**: **OTel SDK** (Python) using GenAI semantic conventions — `gen_ai.system`, `gen_ai.request.model`, `gen_ai.usage.input_tokens`/`output_tokens`. Flows through the OTel Collector to Dynatrace AI Observability.
- **LLM provider**: `LLM_PROVIDER` env var (`openai` | `anthropic` | `local`)

### IoT Simulator
- **Language**: Go 1.26
- **Port**: 8088 (admin/control API)
- **Role**: Generic, config-driven fake IoT device fleet. Device types, counts, metrics (value ranges/patterns), logs, and one level of parent/child hierarchy all come from `industry.iot.deviceTypes` — nothing is hardcoded to an industry. Each device runs as its own goroutine emitting OTLP metrics, logs, and trace spans directly to the shared OTel Collector on a configurable tick — no ingestion hop, no Kafka pipeline. Dynatrace's own AI does anomaly detection; fault-gate problem injection is managed at runtime via the admin API.
- **Instrumentation**: **OTel SDK** (Go) — Go has no OneAgent APM agent. Resource attributes include `device.type`, `device.id`, `device.parent_id`.

### Movement Service
- **Language**: Go
- **Port**: 8095
- **Role**: Position/movement calculator for mobile entities — interpolates origin→destination positions for `journey-service`'s fleet so the map shows continuous motion rather than per-state jumps.
- **Instrumentation**: OTel SDK (Go)

### Notification Service
- **Language**: Node.js 20 / Express
- **Port**: 8087
- **Role**: Kafka consumer across the event topics (see [Kafka Topics](#kafka-topics)). Stores in-app notifications in an in-memory store, served to the ops dashboard via SSE (Server-Sent Events).
- **Instrumentation**: OneAgent (auto)

### News Ticker Service
- **Language**: Node.js 20
- **Port**: 8095
- **Role**: Generic ambient news/headline content for the public portal's flavor ticker module. Industry-flavored headlines come from the industry config (authoring Rule P7), not from this service.
- **Instrumentation**: OneAgent (auto)

### Weather Service
- **Language**: Node.js 20
- **Port**: 8096
- **Role**: Simulated weather data for ambient home-screen widgets (no real external weather API call).
- **Instrumentation**: OneAgent (auto)

### Demo Control API
- **Language**: Node.js 20 / Fastify
- **Port**: 3001
- **Role**: Internal REST API for the Demo Control panel. Injects faults purely over HTTP — `POST /admin/fault` on each target service (in-memory flags) — manages the IoT device fleet (add/remove devices, set fault gates) via `iot-simulator`'s admin API, and controls the traffic bot. No Kubernetes API access or RBAC.
- **Instrumentation**: OneAgent (auto)

### Traffic Bot
- **Language**: Node.js 20
- **Port**: 8089 (health/control)
- **Role**: Drives realistic user journeys against the API gateway — browsing, account creation, request submission, chatbot interactions — on weighted random schedules.
- **Instrumentation**: None (it is the load driver, not a subject of observation)

---

## Data Architecture

### PostgreSQL — the entity engine's core table

The old per-entity-type tables (`citizens`, `service_requests`, `incidents`,
`work_orders`, ...) are gone. Everything the entity engine manages lives in one
polymorphic table, with an append-only event log alongside it:

```
meridian (database)
└── entities
    ├── entity        One row per entity, any type:
    │                   id, entity_type, state, data (JSONB), links (JSONB),
    │                   state_entered_at, next_transition_at, owner_id
    └── entity_event   Append-only state-transition log:
                        entity_id, entity_type, event_type, from_state, to_state,
                        occurred_at, payload (JSONB)
```

An industry's `industry.entities.<type>` block defines the shape that lives in
`data`/`links` and the legal `states`/`transitions` — there is no schema
migration per industry, because there's no per-type table to migrate.

`identity-service`, `workflow-service`, `transaction-service`, and
`journey-service` each own their own, smaller, domain-specific schema (accounts,
work orders, transactions, journeys respectively) — they are not part of the
generic entity engine's polymorphic table. They are still config-driven: each
has its own `industry.services.<name>` block (e.g. `workflow.ownedTypes` /
`dispatchRules`, `transaction.orderFulfillment`) that an industry config can
tune, independently of the free-form `industry.entities` types routed to
`customer-entity-service`/`ops-entity-service`.

### Kafka Topics

| Topic | Partitions | Retention | Producer → Consumer |
|---|---|---|---|
| `iot.telemetry.raw` | 3 | 1d | `iot-simulator` |
| `iot.anomalies` | 1 | 1d | → `workflow-service` (incident creation) |
| `identity.events` | 2 | 7d | `identity-service` → `notification-service` |
| `workflow.events` | 2 | 7d | `workflow-service` → `notification-service` |
| `transaction.events` | 2 | 7d | `transaction-service` → `notification-service` |
| `journey.events` | 1 | 7d | `journey-service` → `notification-service` |
| `notifications.outbound` | 1 | 1h | → `notification-service` |
| `commerce.events` | 2 | 7d | legacy topic name, still provisioned |
| `citizens.events` | 2 | 7d | legacy topic name, still provisioned |
| `billing.events` | 1 | 7d | legacy topic name, still provisioned |

---

## Dynamic Demo Data

Demo data is **generated, not fixtured**. `scripts/deploy.sh seed` runs
`scripts/semantic-seed.py`, which:

1. Reads the rendered industry config (entity definitions, fields, screens) —
   it has no built-in knowledge of any specific domain.
2. For each active entity type, prompts the configured LLM (OpenAI/Anthropic/
   a local Ollama model) to generate realistic first-boot records matching that
   type's fields and the industry's own terminology.
3. Inserts the results into `entities.entity`.

Controlled by `generateSampleData: always | if_needed | never` in
`values-custom.yaml` — `if_needed` (the default) skips generation if the table
already has rows, so re-running `deploy.sh seed` is safe.

> `scripts/seed-data.sh` (static SQL against the old per-type tables/schemas)
> predates this and is no longer invoked by `deploy.sh` — it's kept only for
> reference on very old branches. Use `deploy.sh seed` / `semantic-seed.py`.

---

## Dynatrace Instrumentation Strategy

### OneAgent (automatic, no code changes)

The Dynatrace Operator — installed by `scripts/deploy.sh` as its own Helm release in the `dynatrace` namespace — runs in `applicationMonitoring` mode: it injects the OneAgent code module as an init container (via the CSI driver) into pods in the instance namespace (label `dynatrace.com/inject=true`). OneAgent automatically instruments all Java (Spring Boot), Node.js, and Python services: SQL traces, HTTP spans, Kafka producer/consumer spans, and runtime metrics.

### OTel SDK (explicit, code-level instrumentation)

Used where OneAgent does not have APM support (Go) and where deeper semantic metadata is needed (AI observability):

| Service | SDK | Reason |
|---|---|---|
| `iot-simulator` | Go OTel SDK | No OneAgent Go APM; uses OTel semantic conventions directly |
| `movement-service` | Go OTel SDK | No OneAgent Go APM |
| `ai-service` | Python OTel SDK | OTel GenAI semantic conventions for AI Observability |

OTel telemetry from these services flows through the OTel Collector (OTLP gRPC 4317 / HTTP 4318, CORS-enabled for both frontends) to Dynatrace.

### Business Events (log extraction)

Services emit JSON-structured log lines, under the logger name `BusinessEvents`,
at key state transitions. Dynatrace Business Events extract these into the
analytics stream via log processing rules — no application code change required,
pure tenant-side configuration (auto-provisioned on deploy; see
[dynatrace-config-guide.md](dynatrace-config-guide.md)).

Example (from `identity-service`'s `BusinessEventLogger`):
```json
{
  "timestamp": "2026-06-04T10:30:00.123Z",
  "level": "INFO",
  "logger": "BusinessEvents",
  "event.type": "citizen.registered",
  "account.id": "cit-00123",
  "email": "jane@example.com",
  "zone_id": "zone-3",
  "registration_source": "portal"
}
```

Business Flows are no longer a hardcoded list — a deploy-time provisioner
(`helm/files/provision-dynatrace-business-config.py`) derives one Flow per
entity type in `industry.entities` that defines a `states` state machine, with
steps named `<entity_type>.<state>`. Changing the industry config changes what
shows up in Dynatrace Business Analytics, with no code or manual tenant
configuration needed.

---

## Demo Control Architecture

The `demo-control-api` service orchestrates fault injection purely over HTTP (no
Kubernetes API access — it has no k8s client and needs no RBAC):

1. **Service-level fault injection**: `POST /admin/fault` on each target service. The body shape varies by service; each holds an in-memory flag and artificially delays or degrades (e.g. a DB write, a memory allocation, the LLM call).
2. **IoT device fleet / fault gates**: Calls `iot-simulator`'s device and fault-gate endpoints. The simulator starts/stops device goroutines and pushes a device type's metrics out of range; Dynatrace's own AI does the anomaly detection.
3. **Traffic control**: Calls `traffic-bot`'s start/stop/burst endpoints.

The ops dashboard calls `demo-control-api` through `api-gateway` (prefix
`/api/v1/demo-control/*`, rewritten to `/api/v1/*`, JWT-protected).

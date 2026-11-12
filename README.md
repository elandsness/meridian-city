# Meridian Demo Platform

Meridian is not a fixed demo app anymore — it's a **semantic demo-generation
platform** for [Dynatrace](https://www.dynatrace.com/) full-stack observability.

One generic, config-driven backend (a polymorphic entity engine with real state
machines, not a hardcoded city) can be re-skinned into a realistic, fully-observable
demo for **any industry** — airport, trucking regulator, bank, hospital, utility,
whatever a Sales Engineer needs for the next call — from a single declarative
`values-<industry>.yaml` file. No code changes. The data isn't canned fixtures:
an LLM-driven seeder generates industry-authentic records on first boot, and
every entity's state transitions emit structured signals that Dynatrace turns
into real, live Business Flows for that industry's own vocabulary.

"Meridian City" — citizens, potholes, smart buildings — still exists, but it's
just the **default** config, not a special case: it's the base `industry:` block
in `helm/values.yaml` that every other industry overlay merges on top of.

## ⚠️ Breaking change — read before touching an existing deployment or config

This repository went through a major architectural rewrite: the old fixed city
backend (`citizen-service` / `service-dispatch` / `city-operations`, each with
its own hand-built Postgres tables) was replaced by a **generic entity engine** —
one polymorphic, config-driven table (`entities.entity`) and state machines
defined entirely in the industry YAML, plus dedicated generic services
(`identity-service`, `workflow-service`, `transaction-service`, `journey-service`,
`routing-service`). Dynatrace Business Flows are now *derived automatically*
from each entity type's state machine instead of coming from a hardcoded list.

**Any `values-<industry>.yaml` authored before this rewrite will not deploy
correctly, and may fail the validator outright.** The schema is now explicitly
versioned (`industry.version: 1`) to make that boundary visible. If you (or a
customer-facing team) have an older industry config sitting around, don't try
to run it as-is or hand-patch it — regenerate it with the current authoring kit:

- **What changed, in detail, and how to migrate:** [docs/authoring-kit/README.md § Config compatibility](docs/authoring-kit/README.md#-config-compatibility--read-this-if-you-have-an-existing-values-industryyaml)
- **The current config contract:** [docs/industry-config.schema.json](docs/industry-config.schema.json)

## How it works

| Layer | What it does |
|---|---|
| **Entity engine** | One Spring Boot codebase, deployed twice (`customer-entity-service`, `ops-entity-service`), each owning the entity types tagged for its domain. Entities live in a single polymorphic `entities.entity` table (type, state, JSON data, JSON links) driven entirely by the active industry's config — nothing industry-specific is compiled in. |
| **Industry config** | A `values-<industry>.yaml` overlay declares company/branding, terminology, screens, and `entities:` — typed fields, a state machine (`states`/`transitions`), and a `generator` that keeps the simulation running. Validated against [`docs/industry-config.schema.json`](docs/industry-config.schema.json). |
| **Dynamic demo data** | `scripts/semantic-seed.py` reads the live industry config, knows nothing about the specific domain, and asks the configured LLM to generate realistic first-boot records per entity type — not fixtures baked into the repo. |
| **Business observability** | Every entity transition can emit a structured signal. A deploy-time provisioner turns each entity type's state machine into a real Dynatrace Business Flow and routes its signals into Business Analytics automatically — the flow's steps and labels come from the industry config, not from Meridian's own code. |
| **Authoring kit** | An LLM-driven workflow (`/generate-industry-config` in Claude Code, or a portable prompt for any LLM) researches a new industry, designs its entities, and writes + validates the overlay file. See [Authoring new industries](#authoring-new-industries) below. |

## What it demonstrates

| Dynatrace Capability | How |
|---|---|
| **Full-stack APM** | 16 backend services across Java, Node.js, Python, and Go, auto-instrumented by OneAgent |
| **OpenTelemetry ingestion** | The IoT device simulator (Go), movement service (Go), and AI service (Python) instrument with the OTel SDK; all data flows through an OTel Collector to Dynatrace |
| **Davis AI / anomaly detection** | The Demo Control panel injects failures (DB slowdown, memory pressure, LLM latency, IoT fault gates); Davis AI detects and explains root cause |
| **AI Observability** | A configurable-LLM chatbot; Dynatrace captures token usage, latency, and model metadata per call via GenAI semantic conventions |
| **Business Events / Analytics** | Structured JSON logs from every entity's state transitions are extracted as Business Events; Business Flows are generated automatically from the active industry's entity state machines |
| **Log Management** | Every service emits structured JSON logs, ingested via the OTel Collector's logs pipeline |
| **Site Reliability Guardian** | SLOs for request submission, chatbot latency, IoT ingest, and core API availability |

## Architecture

```
Public Portal (React)              Ops Dashboard: Command Center
  skinned per-industry by               + Demo Control (React)
  values-<industry>.yaml                        │
        │                                        │
        └────────────────┬───────────────────────┘
                          ▼
               API Gateway (Node.js)
    ┌──────┬────────┬─────┴─────┬──────────┬──────────┬───────────┐
    ▼      ▼        ▼           ▼          ▼          ▼           ▼
Identity  Entity   Workflow  Transaction Journey   Routing    AI Service
Service   Engine*  Service    Service    Service   Service   (chatbot,
(Java)    (Java)   (Java)     (Java)     (Java)    (Java)     Python/OTel)
    │       │         │          │          │          │           │
    └───────┴─────────┴──────────┴──────────┴──────────┘           ▼
                          │                                      LLM API
                          ▼                              (OpenAI/Anthropic/Ollama)
                     PostgreSQL
           entities.entity — one polymorphic, config-driven
           table + state-transition event log for every
           industry's entity types

IoT Simulator (Go) ──┐
Movement Service (Go)├──OTLP──► OTel Collector ──────────────► Dynatrace SaaS
Analytics Service ───┘          (+ OneAgent, all services)
(Python/OTel)
```
*Entity Engine is one image deployed as two independently-scaled roles —
`customer-entity-service` and `ops-entity-service` — sharing one config.

News Ticker, Weather, Notification, Traffic Bot, and Demo Control API round out
the ambient/demo-infrastructure layer. See [docs/architecture.md](docs/architecture.md)
for the full service-by-service reference, Kafka topics, and instrumentation strategy.

## Quick Start

### Prerequisites

- Kubernetes cluster (EKS / AKS / GKE, or a local cluster for development)
- `kubectl` >= 1.26 configured against your cluster
- `helm` >= 3.12
- A Dynatrace SaaS tenant with an API token (scopes: `metrics.ingest`, `logs.ingest`, `openTelemetryTrace.ingest`, `entities.read`, `settings.write`, `DataExport`)

### Deploy the default profile ("Meridian City")

```bash
# 1. Add required Helm chart repositories
./scripts/deploy.sh repos

# 2. Create your secrets file from the minimal template
#    (copy from the example — do NOT copy all of values.yaml; stale values there
#    silently override fixes made in values.yaml and cause hard-to-debug issues)
cp helm/values-custom.yaml.example helm/values-custom.yaml
# Fill in the required "" values in values-custom.yaml:
#   appImageRegistry                            → your image registry (e.g. ghcr.io/<org>/meridian-city)
#   dynatrace.apiUrl / apiToken / otlpEndpoint  → your Dynatrace tenant
#   llm.openai.apiKey (or llm.anthropic.apiKey) → your LLM API key (also used for dynamic demo-data generation)

# 3. Install
./scripts/deploy.sh install -f helm/values-custom.yaml

# 4. Validate
kubectl get pods -n meridian-<hash>   # deploy.sh prints the generated instance hash
```

Full instructions, including multi-tenant concurrent installs on a shared cluster,
in [docs/setup-guide.md](docs/setup-guide.md).

### Deploy a different industry

```bash
./scripts/deploy.sh install -f helm/values-custom.yaml -f helm/values-airport.yaml
# or: -f helm/values-nhvr.yaml, or any values-<industry>.yaml you've generated
```

An industry overlay only replaces the `industry:` block (and a couple of
top-level service toggles, e.g. `journeyService.enabled`) — Helm merges it on
top of the base chart, so everything else (infra, multi-tenancy, Dynatrace
wiring) stays the same regardless of industry.

## Authoring new industries

Every industry — including the default "Meridian City" — is just a
`values-<industry>.yaml` overlay. Nothing about a specific domain is compiled
into the platform: the entity engine executes whatever state machines the
config declares, screens are composed from a generic module library, and the
Dynatrace side (service map labels, Business Flows) is generated from the same
file. Building a new one means authoring that YAML, not writing code.

**The fastest way — Claude Code:**

```
/generate-industry-config
```

This invokes a purpose-built agent that asks for the industry/company/brand,
researches the domain, designs entity types as config-driven state machines
whose transitions map to real Dynatrace Business Flow steps, assembles the
full YAML, and loops `scripts/validate-industry-config.mjs` until it passes —
then writes `helm/values-<industry>.yaml` for you.

**Without Claude Code:** copy the prompt in
[docs/authoring-kit/AUTHORING_PROMPT.md](docs/authoring-kit/AUTHORING_PROMPT.md)
into any capable LLM (ChatGPT, Gemini, Claude, Copilot...), answer its
questions, save the YAML it produces, and validate it yourself:

```bash
node scripts/validate-industry-config.mjs helm/values-<industry>.yaml
```

What an industry config actually controls:
- **Branding & terminology** — company name, tagline, colors, and the nouns used
  everywhere (`customer` → "Patient", `request` → "Claim", etc.)
- **Screens & home modules** — which generic templates (`entity-list`,
  `entity-map`, `status-map`, a flavor news ticker, ...) appear on the public
  portal, and in what order
- **Entities** — typed fields, a state machine (`states` + `transitions`), which
  domain (`customer` or `ops`) owns it, and a `generator` that keeps instances
  flowing so the demo is never static
- **A moving fleet**, if the industry has one — vehicles gliding between named
  locations, served by a dedicated `journey-service` rather than a custom entity
- **IoT device fleet** — device types, metrics, and fault behavior, if the
  industry has physical assets to monitor
- **Dynatrace naming** — the service map labels and which entity types become
  Business Flows, with industry-specific step labels

Two worked examples ship in the repo: [`helm/values-airport.yaml`](helm/values-airport.yaml)
(Meridian International Airport — passengers, flights, a `journey-service` fleet
of ground vehicles) and [`helm/values-nhvr.yaml`](helm/values-nhvr.yaml) (a
heavy-vehicle regulator — permits, inspections, a trucking fleet). Both pass
the validator and deploy as-is; the easiest way to understand the config shape
is to read one end-to-end.

The full reference — DSL, the complete module/screen catalog, platform rules
the generic authoring prompt doesn't cover (why every entity needs a `domain`,
why a fleet needs `entityType: journey`, why unused base entities must be
`null`-ed out, etc.), and the config-compatibility notice for older files — lives in
[**docs/authoring-kit/README.md**](docs/authoring-kit/README.md).

## Demo Scenarios

Worked end-to-end walkthroughs below are written against the default "Meridian
City" profile, but every scenario *type* — trace walkthrough, Davis AI RCA, IoT
alert, AI Observability, business-process funnel — is available in Demo Control
for any industry you generate; only the entity/vocabulary names change.

| # | Scenario | Key Dynatrace Feature |
|---|---|---|
| [1](docs/demo-scripts/scenario-1-distributed-trace.md) | End-to-end distributed trace walkthrough | Service flow, trace waterfall, SQL visibility |
| [2](docs/demo-scripts/scenario-2-davis-ai.md) | Davis AI root cause analysis | Problem detection, RCA, anomaly comparison |
| [3](docs/demo-scripts/scenario-3-iot-alert.md) | IoT telemetry stream + alert | OTel metrics, Davis AI correlation |
| [4](docs/demo-scripts/scenario-4-ai-observability.md) | LLM / AI Observability | GenAI spans, token counting, model latency |
| [5](docs/demo-scripts/scenario-5-business-events.md) | Business Process Observability | Business Events, funnel analytics, drop-off analysis |

## Repository Structure

```
meridian-city/
├── services/              # Backend microservices (16 built by CI)
│   ├── entity-engine/         Java (Spring Boot) — deployed as customer-entity-service + ops-entity-service
│   ├── identity-service/      Java (Spring Boot) — accounts, registration, auth verification
│   ├── workflow-service/      Java (Spring Boot) — service requests, work orders, incidents, assets
│   ├── transaction-service/   Java (Spring Boot) — carts, orders, bills, payments
│   ├── journey-service/       Java (Spring Boot) — moving-fleet lifecycle (entityType: journey)
│   ├── routing-service/       Java (Spring Boot) — dispatch/routing logic
│   ├── api-gateway/           Node.js (Fastify) — single ingress, auth dispatcher, proxy
│   ├── demo-control-api/      Node.js (Fastify) — fault injection, fleet/traffic control
│   ├── notification-service/  Node.js (Express) — Kafka consumer → SSE stream
│   ├── traffic-bot/           Node.js — synthetic user-journey load
│   ├── news-ticker-service/   Node.js — generic ambient news content
│   ├── weather-service/       Node.js — simulated weather data
│   ├── analytics-service/     Python (FastAPI) — KPI rollups, SRG metrics
│   ├── ai-service/            Python (FastAPI) — chatbot, GenAI-instrumented LLM calls
│   ├── iot-simulator/         Go — config-driven fake device fleet, OTLP direct to collector
│   └── movement-service/      Go — position/movement calculator for mobile entities
├── frontends/
│   ├── public-portal/      React (Vite) — customer-facing portal, fully re-skinned per industry
│   └── ops-dashboard/      React (Vite) — fixed Command Center + Demo Control app
├── helm/                   Helm umbrella chart + one values-<industry>.yaml per industry
├── otel/                   OpenTelemetry Collector configuration
├── scripts/                Deploy, teardown, seed, and config-validation helpers
└── docs/                   Architecture, setup guide, authoring kit, demo scripts
```

## Build Status

<!-- Update the org/repo below to match where this repository is hosted. -->
![Build](https://github.com/elandsness/meridian-city/actions/workflows/build.yml/badge.svg)

CI builds and pushes every service and frontend image to GHCR on each push to `main`. The
build authenticates to Docker Hub so base-image pulls aren't throttled by Docker
Hub's anonymous rate limit — set `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` as
repository **Actions secrets** (use a Docker Hub access token). See
[docs/setup-guide.md](docs/setup-guide.md#continuous-integration-image-builds)
for details.

## License

Apache 2.0

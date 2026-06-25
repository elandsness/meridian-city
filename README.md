# Meridian City Platform

A fictional smart city operations platform built to demonstrate [Dynatrace](https://www.dynatrace.com/) full-stack observability across a polyglot microservices architecture.

## What it demonstrates

| Dynatrace Capability | How |
|---|---|
| **Full-stack APM** | 12 microservices across Java, Node.js, Python, and Go auto-instrumented by OneAgent |
| **OpenTelemetry ingestion** | IoT device simulators (Go) and AI service (Python) instrument with OTel SDK; all data flows through an OTel Collector to Dynatrace |
| **Davis AI / anomaly detection** | Demo control panel injects failures (DB slowdown, memory pressure, LLM latency); Davis AI detects and explains root cause |
| **AI Observability** | Citizen chatbot backed by configurable LLM; Dynatrace captures token usage, latency, and model metadata per call |
| **Business Events / Analytics** | JSON-structured logs from all Java services are extracted as Business Events; three complete business process funnels are visible in Dynatrace Business Analytics |
| **Log Management** | All services emit structured JSON logs ingested and indexed by Dynatrace |
| **Site Reliability Guardian** | Pre-defined SLOs for citizen request submission, chatbot latency, IoT ingest, and city operations API availability |

## Application narrative

The City of Meridian operates a digital platform. Citizens report potholes, request permits, and chat with an AI assistant on the public portal. Operators monitor 30 connected vehicles, 15 smart buildings, and 10 industrial machines through the ops dashboard. When a building's HVAC overheats or a vehicle reports a fault code, IoT telemetry flows through Kafka into the observability pipeline — and Dynatrace sees it all.

## Architecture

```
Public Portal (React)           Ops Dashboard + Demo Panel (React)
        │                                      │
        └──────────────┬───────────────────────┘
                       ▼
             API Gateway (Node.js)
          ┌───────┬────┴──────┬──────────┐
          ▼       ▼           ▼          ▼
     Citizen   Service    City Ops    AI Service
     Service   Dispatch   (Java)     (Python/OTel)
     (Java)    (Java)        │            │
          │       │          │            ▼
          └───────┴──────────┤         LLM API
                             ▼      (OpenAI/Anthropic/Ollama)
                         PostgreSQL

IoT Simulator (Go) ──OTLP──► IoT Ingestion (Go) ──Kafka──► Telemetry Processor (Python)
       │                                                            │
       └──OTLP──► OTel Collector ──────────────────────────────────┘
                       │
                       ▼
                 Dynatrace SaaS
```

See [docs/architecture.md](docs/architecture.md) for the detailed service topology.

## Quick Start

### Prerequisites

- Kubernetes cluster (EKS / AKS / GKE, or local `kind` / Docker Desktop k8s)
- `kubectl` >= 1.26 configured against your cluster
- `helm` >= 3.12
- A Dynatrace SaaS tenant with an API token (scopes: `metrics.ingest`, `logs.ingest`, `openTelemetryTrace.ingest`, `entities.read`, `settings.write`, `DataExport`)

### Deploy

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
#   llm.openai.apiKey (or llm.anthropic.apiKey) → your LLM API key
# (dynatrace.environmentId / deploymentEnvironment / clusterName are optional labels.)

# 3. Install
./scripts/deploy.sh install -f helm/values-custom.yaml

# 4. Validate
kubectl get pods -n meridian
```

Full instructions in [docs/setup-guide.md](docs/setup-guide.md).

## Demo Scenarios

| # | Scenario | Key Dynatrace Feature |
|---|---|---|
| [1](docs/demo-scripts/scenario-1-distributed-trace.md) | End-to-end distributed trace walkthrough | Service flow, trace waterfall, SQL visibility |
| [2](docs/demo-scripts/scenario-2-davis-ai.md) | Davis AI root cause analysis | Problem detection, RCA, anomaly comparison |
| [3](docs/demo-scripts/scenario-3-iot-alert.md) | IoT telemetry stream + alert | OTel metrics, Kafka tracing, Davis AI correlation |
| [4](docs/demo-scripts/scenario-4-ai-observability.md) | LLM / AI Observability | GenAI spans, token counting, model latency |
| [5](docs/demo-scripts/scenario-5-business-events.md) | Business Process Observability | Business Events, funnel analytics, drop-off analysis |

## Repository Structure

```
meridian-city/
├── services/           # 12 backend microservices
│   ├── api-gateway/        Node.js (Fastify)
│   ├── citizen-service/    Java (Spring Boot)
│   ├── service-dispatch/   Java (Spring Boot)
│   ├── city-operations/    Java (Spring Boot)
│   ├── analytics-service/  Python (FastAPI)
│   ├── ai-service/         Python (FastAPI)
│   ├── iot-ingestion/      Go
│   ├── telemetry-processor/ Python (FastAPI)
│   ├── notification-service/ Node.js (Express)
│   ├── iot-simulator/      Go
│   ├── traffic-bot/        Node.js
│   └── demo-control-api/   Node.js (Fastify)
├── frontends/
│   ├── public-portal/      React (Vite) — citizen-facing city portal
│   └── ops-dashboard/      React (Vite) — ops view + demo control panel
├── helm/               Helm umbrella chart for Kubernetes deployment
├── otel/               OpenTelemetry Collector configuration
├── scripts/            Deploy, teardown, and seed helpers
└── docs/               Architecture, setup guide, and demo scripts
```

## Build Status

<!-- Update the org/repo below to match where this repository is hosted. -->
![Build](https://github.com/elandsness/meridian-city/actions/workflows/build.yml/badge.svg)

CI builds and pushes every service image to GHCR on each push to `main`. The
build authenticates to Docker Hub so base-image pulls aren't throttled by Docker
Hub's anonymous rate limit — set `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` as
repository **Actions secrets** (use a Docker Hub access token). See
[docs/setup-guide.md](docs/setup-guide.md#continuous-integration-image-builds)
for details.

## License

Apache 2.0

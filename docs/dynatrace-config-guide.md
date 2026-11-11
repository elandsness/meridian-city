# Dynatrace Tenant Configuration Guide

After deploying the platform, configure your Dynatrace tenant to enable the advanced demo features. All configuration described here is done manually in the Dynatrace UI.

**Time required**: ~45 minutes for a full configuration.

**Prerequisite — API token scopes.** The token in `values-custom.yaml`
(`dynatrace.apiToken`) needs ingest scopes (`metrics.ingest`, `logs.ingest`,
`openTelemetryTrace.ingest`, `entities.read`, `settings.write`, `DataExport`)
**plus** the operator scopes the DynaKube needs for `applicationMonitoring`
(`installerDownload`, `activeGateTokenManagement.create`, `settings.read`). A
token with only ingest scopes leaves the DynaKube in `Error` and OneAgent never
injects.

---

## 1. Verify Auto-Instrumentation

Before configuring anything, confirm that services are appearing in Dynatrace.

Navigate to: **Observe and Explore → Services**

Expected services (after ~5 minutes of traffic):
- `customer-entity-service` / `ops-entity-service`
- `identity-service`
- `journey-service`
- `movement-service`
- `routing-service`
- `workflow-service`
- `api-gateway`
- `ai-service`
- `analytics-service`
- `notification-service`
- `iot-simulator`

If services are missing, check [setup-guide.md](setup-guide.md) troubleshooting section.

---

## 2. Log Management — Structured Log Processing

The services emit JSON logs. Configure Dynatrace to parse them correctly.

### 2.1 Enable Log Monitoring

**Settings → Log Monitoring → Log sources and storage**

- Verify that `meridian` namespace log sources appear.
- The DynaKube uses `applicationMonitoring` (no host OneAgent — it crash-loops on
  kind), so pod/container logs reach Dynatrace via the OTel Collector's `logs`
  pipeline rather than host log monitoring. If logs are missing, confirm the
  collector is exporting (see the setup-guide troubleshooting section).

### 2.2 Business-event extraction — AUTO-PROVISIONED

> **You no longer create this by hand.** The deploy provisions an OpenPipeline
> custom logs pipeline that parses the `BusinessEvents` JSON log lines and
> extracts them as business events. See §3.

---

## 3. Business Events & Business Flows — AUTO-PROVISIONED

The `BusinessEvents` JSON log lines emitted by the services are turned into
bizevents, and Business Flows are created automatically on deploy.

### 3.1 How it works

A post-install/post-upgrade Helm hook Job runs
`helm/files/provision-dynatrace-business-config.py` against the Settings API. It creates:

1. **OpenPipeline pipeline** `Meridian City — Business Events (<hash>)`:
   - a `dql` processor parses `content` as JSON and surfaces the correlation
     fields plus `meridian.event_type` (the business `event.type` is otherwise
     shadowed by Grail's reserved `event.type`, which is always `LOG`);
   - a `bizevent` processor emits a bizevent with `event.provider = meridian-<hash>.city`,
     `event.type` from `meridian.event_type`, and `includeAll` field extraction.
2. **A logs routing entry** sending
   `k8s.namespace.name == "meridian-<hash>"` + `BusinessEvents` logger lines into
   that pipeline.
3. **Business Flows** derived automatically from the `industry.entities` config.
   Each entity type that defines a `sequence` of states is converted into a Business Flow.
   Example: a `passenger` entity with sequence `checked_in` → `boarded` → `departed`
   becomes a flow with those steps.

> **`<hash>` is the per-instance hash** (e.g. `a1b2`) that `scripts/deploy.sh`
> generates. For a legacy single-instance install, the names fall back to `meridian-business-events`,
> provider `meridian.city`, prefix `[Meridian] `, namespace `meridian`.

### 3.2 Enable it

In `helm/values.yaml` under `dynatrace.businessConfig` (defaults shown):

```yaml
dynatrace:
  businessConfig:
    enabled: true
    appsBaseUrl: ""          # defaults to https://<environmentId>.apps.dynatrace.com
    platformToken: ""        # REQUIRED — dt0s16... platform token (see scopes below)
    eventProvider: ""        # empty -> derived per-instance as meridian-<hash>.city
```

The Job renders only when a **platform token** is present. The token is a **platform token (`dt0s16…`)**, with scopes:
`settings:objects:read`, `settings:objects:write`, `settings:schemas:read`.

### 3.3 Reference: Flow Generation

Flows are now generic. Instead of a fixed list, they are derived from the `industry.entities` block in the Helm values.

| Industry Entity | Example Steps (Derived from `sequence`) | Correlation id |
|---|---|---|
| **Passenger** | `checked_in` $ightarrow$ `security_cleared` $ightarrow$ `boarded` $ightarrow$ `departed` | `passenger.id` |
| **Luggage** | `checked_in` $ightarrow$ `security_scan` $ightarrow$ `sorted` $ightarrow$ `claimed` | `luggage.id` |
| **Flight** | `at_gate` $ightarrow$ `boarding` $ightarrow$ `taxiing` $ightarrow$ `takeoff` $ightarrow$ `departed` | `flight_departure.id` |
| **Service Request** | `submitted` $ightarrow$ `validated` $ightarrow$ `in_progress` $ightarrow$ `resolved` | `service_request.id` |

### 3.4 Demoable failures (business exceptions)

Each flow can have **error branches** to show process failures and conversion drop-off. These are triggered via the **Demo Control** panel in the Ops Dashboard.

When a scenario is activated, the corresponding service emits an error event (e.g. `checkout.payment_failed`) carrying the flow's correlation id. Because the provisioner uses `includeAll` extraction, these events are automatically picked up as bizevents and render as drop-offs in the funnel.

| Demo Control scenario | Effect |
|---|---|
| **Business Process Failures** | Injects failures across all active business flows at a tunable rate. |
| **Custom Industry Faults** | (Configured per industry) triggers specific error events in the generic engine. |

---

## 4. Site Reliability Guardian — SLO Configuration

**Settings → Site Reliability Guardian → Add guardian**

Create one guardian named **Meridian City Platform SLOs** with the following objectives:

### SLO 1: Citizen Request Submission Success Rate
- **Name**: Citizen Request Success Rate
- **Objective type**: Service-level objective
- **Metric**: `builtin:service.errors.total.rate`
- **Entity selector**: `type(SERVICE),tag(app:customer-entity-service)`
- **Target**: 99.5% / **Warning**: 99.9% / **Timeframe**: 7 days

### SLO 2: AI Chatbot P95 Response Time
- **Name**: AI Chatbot P95 Latency
- **Objective type**: Service-level objective
- **Metric**: `ext:gen_ai.server.request.duration.p95`
- **Target**: < 5000ms / **Warning**: < 3000ms / **Timeframe**: 1 hour

### SLO 3: IoT Telemetry Ingest Availability
- **Name**: IoT Ingest Availability
- **Objective type**: Service-level objective
- **Metric**: `builtin:service.availability`
- **Entity selector**: `type(SERVICE),tag(app:iot-simulator)`
- **Target**: 99% / **Timeframe**: 7 days

### SLO 4: Ops API Availability
- **Name**: Ops API Availability
- **Objective type**: Service-level objective
- **Metric**: `builtin:service.availability`
- **Entity selector**: `type(SERVICE),tag(app:ops-entity-service)`
- **Target**: 99% / **Timeframe**: 7 days

### SLO 5: Checkout Success Rate
- **Name**: Checkout Success Rate
- **Objective type**: Service-level objective
- **Metric**: `builtin:service.errors.total.rate`
- **Entity selector**: `type(SERVICE),tag(app:transaction-service)`
- **Target**: 99.5% / **Timeframe**: 7 days

### SLO 6: Payment Processing Availability
- **Name**: Payment Processing Availability
- **Objective type**: Service-level objective
- **Metric**: `builtin:service.availability`
- **Entity selector**: `type(SERVICE),tag(app:transaction-service)`
- **Target**: 99% / **Timeframe**: 7 days

---

## 5. Alerting — Davis AI Problem Detection

Davis AI automatically detects anomalies. For the demo, ensure these are configured:

**Settings → Anomaly detection → Services**

For the core entity services:
- Response time degradation: **Auto**
- Failure rate increase: **Auto**

This ensures that when the demo panel injects a DB slowdown, Davis AI will detect it within 1-2 minutes.

### Custom anomaly alert for IoT

**Settings → Anomaly detection → Custom events for alerting → Add metric event**

- **Metric**: `iot.building.hvac_temp`
- **Condition**: Average > 85°C
- **Alert name**: Building HVAC Temperature Alert
- **Severity**: Error

---

## 6. Dashboards

Import these dashboard templates from the Dynatrace Hub or create manually:

### Recommended dashboard: Meridian City Operations

Create a new dashboard with these tiles:
1. **Service Health Overview**: Single Value tile — `builtin:service.availability` for all meridian services.
2. **Request Throughput**: Time Series — `builtin:service.requestCount.total` for `customer-entity-service`.
3. **IoT Metrics**: Time Series — `iot.vehicle.engine_temp`, `iot.building.hvac_temp`.
4. **AI Chatbot Usage**: Time Series — `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens`.
5. **Business Events Funnels**: Business Analytics tiles for the primary flows defined in the industry config (e.g. Passenger Journey, Flight Departure).
6. **Financials**: Business Analytics — sum of `transaction.amount_cents` for completed orders.
7. **RUM — Core Web Vitals**: Web application tile for the public-portal and ops-dashboard apps.
8. **RUM — User actions**: Top user actions by application.
9. **SLO Status**: SLO tile — all six SLOs.

---

## 7. AI Observability Setup

The `gen_ai.*` spans are produced by the **OpenLLMetry (Traceloop) SDK** auto-instrumenting the OpenAI/Anthropic clients in ai-service and exported via the OTel collector.

AI Observability is enabled automatically when Dynatrace receives spans with GenAI semantic convention attributes. Verify under **AI Observability** in the left nav:
- Model name, token usage, P95 latency, and request count.

---

## 8. RUM — Front-end User sessions

Both SPAs (public-portal, ops-dashboard) report Real User Monitoring via the Dynatrace agentless RUM JS.

1. In Dynatrace create a **web application** for each SPA: **Web → Set up → Manual insertion**.
2. Copy the `<script ...></script>` tag.
3. Paste into `values-custom.yaml` and enable:
```yaml
publicPortal:
  rum:
    enabled: true
    snippet: '<script src="https://.../ruxitagentjs_....js" ...></script>'
opsDashboard:
  rum:
    enabled: true
    snippet: '<script ...></script>'
```
4. Redeploy (`scripts/deploy.sh`).

---

## Quick Checklist

Before a customer demo, verify these are all working:
- [ ] All 12 services visible in Dynatrace Services.
- [ ] IoT metrics visible under `iot.*`.
- [ ] AI Observability shows chatbot traces.
- [ ] RUM: both web apps report sessions + user actions.
- [ ] Business Events funnels show data for the active industry entities.
- [ ] All 6 SLOs are in the green.
- [ ] Test fault injection: inject DB slowdown → wait 2 min → confirm Davis problem card.
- [ ] Reset all faults before the demo.

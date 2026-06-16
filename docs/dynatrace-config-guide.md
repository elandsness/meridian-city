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
- `citizen-service`
- `service-dispatch`
- `city-operations`
- `api-gateway`
- `ai-service`
- `analytics-service`
- `notification-service`
- `iot-ingestion`
- `telemetry-processor`

If services are missing, check [setup-guide.md](setup-guide.md) troubleshooting section.

---

## 2. Log Management — Structured Log Processing

The Java services emit JSON logs. Configure Dynatrace to parse them correctly.

### 2.1 Enable Log Monitoring

**Settings → Log Monitoring → Log sources and storage**

- Verify that `meridian` namespace log sources appear.
- The DynaKube uses `applicationMonitoring` (no host OneAgent — it crash-loops on
  kind), so pod/container logs reach Dynatrace via the OTel Collector's `logs`
  pipeline rather than host log monitoring. If logs are missing, confirm the
  collector is exporting (see the setup-guide troubleshooting section).

### 2.2 Create a Log Processing Rule

**Settings → Log Monitoring → Processing rules → Add processing rule**

**Name**: `Meridian Business Event Extraction`

**Matcher**: `log.source matches "citizen-service" OR log.source matches "service-dispatch" OR log.source matches "city-operations"`

**Processor definition** (DQL):
```
PARSE(content, "JSON:parsed")
| FIELDS_ADD(
    event_type: parsed["event.type"],
    request_id: parsed["request.id"],
    citizen_id: parsed["citizen.id"],
    request_category: parsed["request.category"]
  )
```

This makes the structured fields available for Business Events and log queries.

---

## 3. Business Events Configuration

Business Events let Dynatrace model your application's business processes as funnels and KPI metrics. We configure three flows.

### 3.1 Navigate to Business Events

**Settings → Business Analytics → Business Events**

### Flow A: Citizen Service Request Lifecycle

Create a new Business Events source with these settings:

| Field | Value |
|---|---|
| **Source** | Logs |
| **Event type field** | `event_type` |
| **Event provider** | `citizen-service, service-dispatch, city-operations` |

**Event mappings** (create one for each step):

| Business Event Name | Log event.type value | Attributes to extract |
|---|---|---|
| `service_request.submitted` | `service_request.submitted` | `request.id`, `citizen.id`, `request.category`, `request.priority` |
| `service_request.validated` | `service_request.validated` | `request.id` |
| `service_request.dispatched` | `service_request.dispatched` | `request.id`, `assigned_department` |
| `service_request.assigned` | `service_request.assigned` | `request.id`, `assigned_to` |
| `service_request.status_updated` | `service_request.status_updated` | `request.id`, `previous_status`, `new_status` |

> The app emits one `service_request.status_updated` event per status change
> (carrying `previous_status`/`new_status`) — there are no separate
> `in_progress`/`resolved` events. Derive those stages from the status fields.

**Funnel configuration** (in Business Analytics):
- Create a funnel with steps in the order above
- Correlation key: `request.id`
- Funnel name: `Service Request Journey`

### Flow B: Citizen Registration

Registration is a single step today — citizen-service emits one
`citizen.registered` event per `POST /api/v1/citizens`. There is no multi-stage
verification/activation flow in the app, so there's no abandonment funnel to
build unless the app is extended to emit intermediate `account.*` events.

| Business Event Name | Log event.type value | Attributes |
|---|---|---|
| `citizen.registered` | `citizen.registered` | `citizen.id`, `email`, `zone.id` |

### Flow C: IoT Incident Resolution

| Business Event Name | Log event.type value |
|---|---|
| `iot.anomaly_detected` | `iot.anomaly_detected` |
| `incident.created` | `incident.created` |
| `workorder.created` | `workorder.created` |

> Only these three events are emitted today. `workorder.assigned` /
> `acknowledged` / `resolved` don't exist as business events — work-order status
> lives in the DB. Add app events to extend the funnel.

- Correlation key: `incident.id`
- Funnel name: `IoT Incident Resolution`

---

## 4. Site Reliability Guardian — SLO Configuration

**Settings → Site Reliability Guardian → Add guardian**

Create one guardian named **Meridian City Platform SLOs** with the following objectives:

### SLO 1: Citizen Request Submission Success Rate

| Setting | Value |
|---|---|
| **Name** | Citizen Request Success Rate |
| **Objective type** | Service-level objective |
| **Metric** | `builtin:service.errors.total.rate` |
| **Entity selector** | `type(SERVICE),tag(app:citizen-service)` |
| **Target** | 99.5% |
| **Warning** | 99.9% |
| **Timeframe** | 7 days |

### SLO 2: AI Chatbot P95 Response Time

| Setting | Value |
|---|---|
| **Name** | AI Chatbot P95 Latency |
| **Objective type** | Service-level objective |
| **Metric** | `ext:gen_ai.server.request.duration.p95` (OTel metric) |
| **Target** | < 5000ms |
| **Warning** | < 3000ms |
| **Timeframe** | 1 hour |

### SLO 3: IoT Telemetry Ingest Availability

| Setting | Value |
|---|---|
| **Name** | IoT Ingest Availability |
| **Objective type** | Service-level objective |
| **Metric** | `builtin:service.availability` |
| **Entity selector** | `type(SERVICE),tag(app:iot-ingestion)` |
| **Target** | 99% |
| **Timeframe** | 7 days |

### SLO 4: City Operations API Availability

| Setting | Value |
|---|---|
| **Name** | City Operations API Availability |
| **Objective type** | Service-level objective |
| **Metric** | `builtin:service.availability` |
| **Entity selector** | `type(SERVICE),tag(app:city-operations)` |
| **Target** | 99% |
| **Timeframe** | 7 days |

---

## 5. Alerting — Davis AI Problem Detection

Davis AI automatically detects anomalies. For the demo, ensure these are configured:

**Settings → Anomaly detection → Services**

For `citizen-service`:
- Response time degradation: **Auto** (Davis learns baseline)
- Failure rate increase: **Auto**

This ensures that when the demo panel injects a DB slowdown, Davis AI will detect it within 1-2 minutes.

### Custom anomaly alert for IoT

**Settings → Anomaly detection → Custom events for alerting → Add metric event**

| Setting | Value |
|---|---|
| **Metric** | `iot.building.hvac_temp` |
| **Condition** | Average > 85°C (note: the platform's own detector requires 3 consecutive 1-min windows, so an injected HVAC anomaly raises an incident after ~3 min) |
| **Alert name** | Building HVAC Temperature Alert |
| **Severity** | Error |

---

## 6. Dashboards

After configuring the above, import these dashboard templates from the Dynatrace Hub or create manually:

### Recommended dashboard: Meridian City Operations

Create a new dashboard with these tiles:

1. **Service Health Overview**: Single Value tile — `builtin:service.availability` for all meridian services
2. **Request Throughput**: Time Series — `builtin:service.requestCount.total` for `citizen-service`
3. **IoT Metrics**: Time Series — `iot.vehicle.engine_temp`, `iot.building.hvac_temp`
4. **AI Chatbot Usage**: Time Series — `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens`
5. **Business Events Funnel**: Business Analytics tile — Service Request Journey funnel
6. **SLO Status**: SLO tile — all four SLOs

### Export and share

After building the dashboard, export as JSON:
**Dashboard → ... menu → Export**

Save the JSON to `docs/dashboards/meridian-city-ops.json` for distribution to DXC staff.

---

## 7. AI Observability Setup

The `gen_ai.*` spans are produced by the **OpenLLMetry (Traceloop) SDK** auto-instrumenting the OpenAI/Anthropic clients in ai-service (no manual span attributes) and exported via the OTel collector. Each carries `session_id` as a Traceloop association property, so an AI interaction can be correlated to its RUM session and `chatbot.interaction` business event. See `docs/INSTRUMENTATION.md` §2.

AI Observability is enabled automatically when Dynatrace receives spans with GenAI semantic convention attributes. Verify:

**AI Observability** (in the left nav)

After making chatbot requests, you should see:
- Model name (`gpt-4o`, `claude-sonnet-4-6`, or `llama3`)
- Token usage per request
- P95 latency
- Request count over time

If the AI Observability menu item is not visible, enable it in **Settings → Feature flags**.

---

## Quick Checklist

Before a customer demo, verify these are all working:

- [ ] All 9 services visible in Dynatrace Services
- [ ] IoT metrics visible under `iot.*` (e.g. `iot.building.hvac_temp`)
- [ ] AI Observability shows chatbot traces
- [ ] Business Events funnel shows data (submit a test request)
- [ ] All 4 SLOs are in the green
- [ ] Davis AI baseline established (needs ~24h of traffic)
- [ ] Test fault injection: inject DB slowdown → wait 2 min → confirm Davis problem card
- [ ] Reset all faults before the demo

# Dynatrace Tenant Configuration Guide

After deploying the platform, configure your Dynatrace tenant to enable the advanced demo features. All configuration described here is done manually in the Dynatrace UI.

**Time required**: ~45 minutes for a full configuration.

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
- If not: ensure the DynaKube CR has log monitoring enabled (it is by default in CloudNativeFullStack mode).

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
| `service_request.in_progress` | `service_request.in_progress` | `request.id` |
| `service_request.resolved` | `service_request.resolved` | `request.id`, `resolution_time_minutes` |

**Funnel configuration** (in Business Analytics):
- Create a funnel with steps in the order above
- Correlation key: `request.id`
- Funnel name: `Service Request Journey`

### Flow B: Citizen Account Creation

| Business Event Name | Log event.type value |
|---|---|
| `account.registration_started` | `account.registration_started` |
| `account.details_submitted` | `account.details_submitted` |
| `account.verification_sent` | `account.verification_sent` |
| `account.verified` | `account.verified` |
| `account.activated` | `account.activated` |

- Correlation key: `citizen.id`
- Funnel name: `Account Registration Funnel`

### Flow C: IoT Incident Resolution

| Business Event Name | Log event.type value |
|---|---|
| `iot.anomaly_detected` | `iot.anomaly_detected` |
| `incident.created` | `incident.created` |
| `workorder.created` | `workorder.created` |
| `workorder.assigned` | `workorder.assigned` |
| `workorder.acknowledged` | `workorder.acknowledged` |
| `workorder.resolved` | `workorder.resolved` |

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
| **Metric** | `iot.device.building.hvac_temp` |
| **Condition** | Average > 85°C for 1 minute |
| **Alert name** | Building HVAC Temperature Alert |
| **Severity** | Error |

---

## 6. Dashboards

After configuring the above, import these dashboard templates from the Dynatrace Hub or create manually:

### Recommended dashboard: Meridian City Operations

Create a new dashboard with these tiles:

1. **Service Health Overview**: Single Value tile — `builtin:service.availability` for all meridian services
2. **Request Throughput**: Time Series — `builtin:service.requestCount.total` for `citizen-service`
3. **IoT Metrics**: Time Series — `iot.device.vehicle.engine_temp`, `iot.device.building.hvac_temp`
4. **AI Chatbot Usage**: Time Series — `gen_ai.usage.prompt_tokens`, `gen_ai.usage.completion_tokens`
5. **Business Events Funnel**: Business Analytics tile — Service Request Journey funnel
6. **SLO Status**: SLO tile — all four SLOs

### Export and share

After building the dashboard, export as JSON:
**Dashboard → ... menu → Export**

Save the JSON to `docs/dashboards/meridian-city-ops.json` for distribution to DXC staff.

---

## 7. AI Observability Setup

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
- [ ] IoT metrics visible under `iot.device.*`
- [ ] AI Observability shows chatbot traces
- [ ] Business Events funnel shows data (submit a test request)
- [ ] All 4 SLOs are in the green
- [ ] Davis AI baseline established (needs ~24h of traffic)
- [ ] Test fault injection: inject DB slowdown → wait 2 min → confirm Davis problem card
- [ ] Reset all faults before the demo

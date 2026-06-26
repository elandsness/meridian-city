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

### 2.2 Business-event extraction — AUTO-PROVISIONED

> **You no longer create this by hand.** The deploy provisions an OpenPipeline
> custom logs pipeline that parses the `BusinessEvents` JSON log lines and
> extracts them as business events. See §3.

---

## 3. Business Events & Business Flows — AUTO-PROVISIONED

The `BusinessEvents` JSON log lines emitted by the services are turned into
bizevents, and a Business Flow is created per `/analytics` process — **all
automatically on deploy**, so the tenant shows the finished result without any
manual instrumentation steps.

### 3.1 How it works

A post-install/post-upgrade Helm hook Job runs
`helm/files/provision-dynatrace-business-config.py` against the Settings API
(modern platform endpoint). It is **idempotent** (match-by-name/customId →
update in place) and creates:

1. **OpenPipeline pipeline** `Meridian City — Business Events`
   (`builtin:openpipeline.logs.pipelines`, customId `meridian-business-events`):
   - a `dql` processor parses `content` as JSON and surfaces the correlation
     fields plus `meridian.event_type` (the business `event.type` is otherwise
     shadowed by Grail's reserved `event.type`, which is always `LOG`);
   - a `bizevent` processor emits a bizevent with `event.provider = meridian.city`,
     `event.type` from `meridian.event_type`, and `includeAll` field extraction.
2. **A logs routing entry** (merged into the single
   `builtin:openpipeline.logs.routing` object — never overwritten) sending
   `k8s.namespace.name == "meridian"` + `BusinessEvents` logger lines into that
   pipeline.
3. **Five Business Flows** (`app:dynatrace.biz.flow:biz-flow-settings`), one per
   process, each correlated on a single id (see table below).

### 3.2 Enable it

In `helm/values.yaml` under `dynatrace.businessConfig` (defaults shown):

```yaml
dynatrace:
  businessConfig:
    enabled: true
    appsBaseUrl: ""          # defaults to https://<environmentId>.apps.dynatrace.com
    platformToken: ""        # REQUIRED — dt0s16... platform token (see scopes below)
    eventProvider: "meridian.city"
```

The Job renders only when a **platform token** is present (so it's a no-op until
configured). The token is a **platform token (`dt0s16…`)**, distinct from the
classic `dynatrace.apiToken`, with scopes:
`settings:objects:read`, `settings:objects:write`, `settings:schemas:read`.

### 3.3 What gets created (reference)

| Business Flow | Steps (`event.type`) | Correlation id |
|---|---|---|
| **Service Request Lifecycle** | `service_request.submitted` → `.validated` → `.dispatched` → `.assigned` → `.in_progress` → `.resolved` | `request.id` |
| **Account Creation** | `account.registration_started` → `.details_submitted` → `.verification_sent` → `.verified` → `.activated` | `citizen.id` |
| **IoT Incident Resolution** | `iot.anomaly_detected` → `incident.created` → `workorder.created` → `.assigned` → `.acknowledged` → `.resolved` | `incident.id` |
| **City Store Purchase** | `cart.item_added` → `checkout.completed` → `order.packed` → `.shipped` → `.delivered` | `cart.id` |
| **Tax Payment** | `tax.bill_issued` → `tax.payment_completed` | `bill.id` |

All correlation ids are carried on every step's event by the services'
`BusinessEventLogger` (e.g. work-order events carry `incident.id`; order events
carry `cart.id`). To change the taxonomy, edit `FLOW_SPECS` / `DQL_SCRIPT` in the
provisioner — it is the single source of truth for both the extraction and the
flows.

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

### SLO 5: Checkout Success Rate

| Setting | Value |
|---|---|
| **Name** | Checkout Success Rate |
| **Objective type** | Service-level objective |
| **Metric** | `builtin:service.errors.total.rate` |
| **Entity selector** | `type(SERVICE),tag(app:commerce-service)` |
| **Target** | 99.5% |
| **Timeframe** | 7 days |

### SLO 6: Payment Processing Availability

| Setting | Value |
|---|---|
| **Name** | Payment Processing Availability |
| **Objective type** | Service-level objective |
| **Metric** | `builtin:service.availability` |
| **Entity selector** | `type(SERVICE),tag(app:billing-service)` |
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
5. **Business Events Funnels**: Business Analytics tiles — Service Request Journey, **City Store Purchase**, and **Tax Payment** funnels
6. **Orders & Revenue**: Business Analytics — count of `checkout.completed` events and sum of `order.total_cents` (÷100 for dollars)
7. **RUM — Core Web Vitals**: Web application tile for the public-portal and ops-dashboard apps
8. **RUM — User actions**: Top user actions by application (`store.checkout`, `tax.pay`, `service_request.submit`, `chat.send`)
9. **SLO Status**: SLO tile — all six SLOs

> **Session → business outcome:** because each RUM custom action carries the same
> key as its funnel (`order.id`, `bill.id`, `request.id`, `session.id`), you can
> open a user session and pivot to the `checkout.completed → order.delivered`
> business events on `order.id` — the headline "front-end to business outcome" story.

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

## 8. RUM — Front-end User Sessions

Both SPAs (public-portal, ops-dashboard) report Real User Monitoring via the
Dynatrace agentless RUM JS, injected at runtime (no image rebuild).

1. In Dynatrace create a **web application** for each SPA:
   **Web → Set up → Manual insertion** (one app per SPA so sessions segment cleanly).
2. Copy each app's single-line `<script ...></script>` tag.
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
   The application id / agent URL is public (shipped to every browser) — keep it in
   values, not the `meridian-secrets` token.
4. Redeploy (`scripts/deploy.sh`). The frontend pods roll automatically (a
   `checksum/config` annotation on the deployment tracks the snippet).

Verify under **Web → <app>**: sessions, user actions, Core Web Vitals, and JS
errors. The custom actions (`store.checkout`, `tax.pay`, `service_request.submit`,
`chat.send`) carry the correlation keys used for the session → funnel join (§3, §6).

---

## Quick Checklist

Before a customer demo, verify these are all working:

- [ ] All 11 services visible in Dynatrace Services (incl. commerce-service, billing-service)
- [ ] IoT metrics visible under `iot.*` (e.g. `iot.building.hvac_temp`)
- [ ] AI Observability shows chatbot traces (OpenLLMetry `gen_ai.*` spans)
- [ ] RUM: both web apps report sessions + user actions (§8)
- [ ] Business Events funnels show data: Service Request, **City Store Purchase**, **Tax Payment**
- [ ] All 6 SLOs are in the green
- [ ] Davis AI baseline established (needs ~24h of traffic)
- [ ] Test fault injection: inject DB slowdown → wait 2 min → confirm Davis problem card
- [ ] Reset all faults before the demo

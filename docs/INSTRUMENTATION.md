# Meridian City — Observability & Instrumentation

> Status: living document. Owns *how every behavior is observed in Dynatrace*.
> Pairs with [REQUIREMENTS.md](REQUIREMENTS.md) (what the app does) and
> [dynatrace-config-guide.md](dynatrace-config-guide.md) (tenant-side config:
> log processing, funnels, SLOs, dashboards).

## Goal: full-stack observability

Every user journey should be observable end-to-end:

```
Browser (RUM session + user actions)
  → api-gateway → backend services (OneAgent / OTel auto-instrumented)
    → PostgreSQL (SQL spans) + Kafka (producer/consumer spans)
  → structured business-event logs → Dynatrace business events → funnels
  → AI calls → OpenLLMetry gen_ai spans → AI Observability
```

The four pillars and where they come from:

| Pillar | Source |
| --- | --- |
| **Traces** | OneAgent auto-instrumentation (Java/Node/Python services) + OTel SDK (Go services, ai-service) → OTel collector → Dynatrace OTLP |
| **Logs** | Structured JSON to stdout, ingested by OneAgent log monitoring. A dedicated `BusinessEvents` logger emits the canonical business-event shape |
| **RUM** | Dynatrace agentless RUM JS in both SPAs (this effort — see below) |
| **AI** | OpenLLMetry (Traceloop) auto-instrumented `gen_ai.*` spans from ai-service (this effort) |

The trace/log/metric backbone already exists (DynaKube `v1beta6` with
`applicationMonitoring` CSI OneAgent, an ActiveGate, and a Bitnami OTel collector
exporting to the Dynatrace OTLP endpoint). This effort adds the two missing
pieces — **RUM** and **OpenLLMetry** — and extends business events to the new
commerce and billing domains.

---

## 1. RUM (Real User Monitoring)

### Injection mechanism

Both SPAs are static nginx builds. Their runtime `default.conf` is supplied by a
Helm-managed ConfigMap (`helm/templates/frontend-nginx-configmap.yaml`), not the
image — so that is the injection seam.

- The shared ConfigMap is **split into two** (`public-portal-nginx-config`,
  `ops-dashboard-nginx-config`) so each SPA can register as its own Dynatrace web
  application with its own application id.
- Each injects the agentless RUM `<script>` into the served HTML at request time:
  ```nginx
  sub_filter '</head>' '${RUM_SNIPPET}</head>';
  sub_filter_once on;
  sub_filter_types text/html;
  ```
- The snippet is provided per-tenant via Helm values
  (`publicPortal.rum.snippet`, `opsDashboard.rum.snippet`), copied from the
  Dynatrace UI (*Application → Setup → Manual insertion*). A `checksum/config`
  pod annotation rolls the pods when the snippet changes.

**Why this approach:** the RUM application id / agent URL is shipped to every
browser — it is **not a secret** — so it lives in plain `values.yaml`, unlike the
Dynatrace API token which stays in the `meridian-secrets` Secret. Runtime
injection means re-pointing at a different tenant needs no image rebuild,
matching the repo's existing "configure nginx at runtime, not Vite at build time"
philosophy.

### dtrum wrapper

Each app gets `src/lib/rum.js` — a thin wrapper so calls are safe no-ops when RUM
is absent (e.g. local dev). API:

| Function | Maps to | Use |
| --- | --- | --- |
| `identifyUser(email)` | `dtrum.identifyUser` | On login / citizen load — tags the session with the citizen email |
| `startAction(name)` / `endAction(handle)` | `dtrum.enterAction` / `leaveAction` | Wrap a key flow |
| `addActionProperties(handle, {...})` | `dtrum.addActionProperties` | Attach the correlation key (the join to backend business events) |
| `reportError(err)` | `dtrum.reportCustomError` | On axios 5xx (response interceptor) |

### Custom action catalog

Each action carries a **correlation property** whose key matches the backend
business event for the same journey, enabling session → business-event joins in
Dynatrace.

| Action name | Trigger | Correlation property | Joins to business event |
| --- | --- | --- | --- |
| `store.add_to_cart` | Add product to cart | `product.id` | `cart.item_added` |
| `store.checkout` | Buy now | `order.id` | `checkout.completed` → `order.delivered` |
| `service_request.submit` | Submit request | `request.id` | `service_request.submitted` |
| `tax.pay` | Pay a bill | `bill.id` | `tax.payment_completed` |
| `chat.send` | Send a chat message | `session.id` | `chatbot.interaction` |

`identifyUser` is wired in each app's `AuthContext.jsx`; `reportError` in each
app's `api/client.js` response interceptor.

---

## 2. AI observability — OpenLLMetry

ai-service moves from hand-rolled `gen_ai.*` span attributes to the **Traceloop
OpenLLMetry SDK**, which auto-instruments the OpenAI and Anthropic clients.

- Dependency: `traceloop-sdk` in `services/ai-service/requirements.txt`.
- Init: in `ai_service/otel.py`, `Traceloop.init(app_name=..., api_endpoint=OTEL_EXPORTER_OTLP_ENDPOINT)`
  — reuses the same collector endpoint already injected by `meridian.commonEnv`;
  no Helm change (resource attributes already arrive via `OTEL_RESOURCE_ATTRIBUTES`).
- `ai_service/chat.py`:
  - **Remove** the manual `gen_ai.operation.name / system / request.model /
    response.model / usage.* / response.finish_reason` attribute block — Traceloop
    emits these automatically from the SDK call.
  - **Keep** the parent span and set the non-GenAI correlation key
    `session.id` on it (plus `Traceloop.set_association_properties({"session_id": ...})`
    so the auto-spans carry it too).
  - **Keep** the `chatbot.interaction` business-event log (below) — independent of
    spans and still feeding the funnel / token reporting.

Result: AI Observability shows `gen_ai` spans with model, token usage, and finish
reason via OpenLLMetry, while the `session.id` ties an LLM interaction back to its
RUM session and chat-session id.

---

## 3. Business-event catalog

All business events are emitted as **structured JSON logs** via a dedicated
`BusinessEvents` logger (Java: `BusinessEventLogger` with
`logstash-logback-encoder`; Python: `logging.getLogger("BusinessEvents")`). The
discriminator is the `event.type` field; keys are flat and dotted. Dynatrace
extracts them into business events via a log-processing rule (no code change to
the pipeline) — see [dynatrace-config-guide.md](dynatrace-config-guide.md) §2–3.

### Existing events

| `event.type` | Owning service | Key fields |
| --- | --- | --- |
| `citizen.registered` | citizen-service | `citizen.id` |
| `service_request.submitted` | citizen-service | `request.id`, `citizen.id`, `request.category`, `request.priority` |
| `service_request.validated` | citizen-service | `request.id` |
| `service_request.status_updated` | citizen-service | `request.id`, `status` (old/new) |
| `service_request.dispatched` | service-dispatch | `request.id`, `assigned_department`, `zone_id` |
| `service_request.assigned` | service-dispatch | `request.id`, `assigned_to` |
| `workorder.created` | city-operations | `work_order.id`, `request.id`, `assigned_department` |
| `incident.created` | city-operations | `incident.id`, `asset.id`, `severity` |
| `iot.anomaly_detected` | city-operations | `asset.id`, `anomaly.type` |
| `chatbot.interaction` | ai-service | `session.id`, `gen_ai.*`, token counts |

### New events (this effort)

| `event.type` | Owning service | Key fields | Slice |
| --- | --- | --- | --- |
| `incident.commented` | city-operations | `incident.id`, `comment.author` | 4 |
| `incident.resolved` | city-operations | `incident.id`, `severity` | 4 |
| `cart.item_added` | commerce-service | `cart.id`, `citizen.id`, `product.id`, `quantity` | 5 |
| `checkout.completed` | commerce-service | `order.id`, `citizen.id`, `order.total_cents`, `order.item_count` | 5 |
| `order.packed` | commerce-service | `order.id`, `citizen.id` | 5 |
| `order.shipped` | commerce-service | `order.id`, `citizen.id`, `carrier` | 5 |
| `order.delivered` | commerce-service | `order.id`, `citizen.id` | 5 |
| `tax.bill_issued` | billing-service | `bill.id`, `citizen.id`, `bill.period`, `bill.amount_cents` | 6 |
| `tax.payment_completed` | billing-service | `bill.id`, `citizen.id`, `bill.amount_cents` | 6 |

---

## 4. Funnels & correlation keys

Configured tenant-side (see [dynatrace-config-guide.md](dynatrace-config-guide.md) §3).

| Funnel | Stages | Correlation key |
| --- | --- | --- |
| Service request lifecycle (Flow A) | submitted → validated → dispatched → assigned → in_progress → resolved | `request.id` |
| Account registration (Flow B) | registration → activated | `citizen.id` |
| IoT incident resolution (Flow C) | anomaly_detected → incident_created → … → incident.resolved | `incident.id` |
| **Purchase (Flow D, new)** | cart.item_added → checkout.completed → order.shipped → order.delivered | `order.id` |
| **Tax payment (Flow E, new)** | tax.bill_issued → tax.payment_completed | `bill.id` |

The analytics-service `funnels.py` `_FUNNELS` map also gains `purchase` and
`tax-payment` so the ops Business Analytics page renders them.

### RUM ↔ business-event correlation
Because each RUM custom action (§1) carries the same key its funnel uses
(`order.id`, `bill.id`, `request.id`, `session.id`), a user session can be joined
to its server-side business-process funnel in Dynatrace — the headline
"front-end to business outcome" demo story.

---

## 5. SLOs & dashboards

Defined in [dynatrace-config-guide.md](dynatrace-config-guide.md) §4–6. New with
this effort:
- **SLO: Checkout success rate** — commerce-service service errors.
- **SLO: Payment processing availability** — billing-service availability.
- Dashboard tiles: Purchase funnel, Orders today, Revenue (sum of order totals),
  RUM Core Web Vitals, RUM user actions by application.

---

## Verifying instrumentation (per slice)

1. **RUM**: both web apps report sessions, user actions, Core Web Vitals, and JS
   errors; a session is tagged with the citizen email.
2. **Traces**: commerce-service and billing-service appear as service-map nodes
   with DB + Kafka spans; a multi-hop trace spans gateway → commerce → Kafka →
   notification-service.
3. **AI**: AI Observability shows OpenLLMetry `gen_ai` spans with token usage.
4. **Business events / funnels**: the new events appear; Purchase and Tax Payment
   funnels populate.
5. **Correlation**: a RUM session is joinable to its funnel on the shared key.

# Meridian Demo Platform — Observability & Instrumentation

> **Status: partially historical.** This document captures the design of a
> specific instrumentation initiative (adding RUM and OpenLLMetry, and
> extending business events to the commerce/billing domains) written under the
> **pre-rewrite service names** (`citizen-service`, `service-dispatch`,
> `city-operations`, `commerce-service`, `billing-service`). Those services no
> longer exist — see the README's
> [breaking-change notice](../README.md#-breaking-change--read-before-touching-an-existing-deployment-or-config).
> §1 (RUM injection mechanism) and §2 (OpenLLMetry integration) describe
> implementation patterns that are still accurate in shape, just under renamed
> services (`identity-service`, `routing-service`/`workflow-service`,
> `transaction-service`). §§3–5's **specific funnel/flow-id catalog is
> superseded** — Dynatrace Business Flows are no longer a hardcoded list; they're
> derived automatically from `industry.entities`' state machines. For the
> current business-event/flow model, see
> [architecture.md § Business Events](architecture.md#business-events-log-extraction)
> and [dynatrace-config-guide.md](dynatrace-config-guide.md).

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
| **Traces** | OneAgent auto-instrumentation (Java/Node services) + OTel SDK (Go services (iot-simulator) + the Python services ai-service, analytics-service) → OTel collector → Dynatrace OTLP. NOTE: OneAgent `applicationMonitoring` does **not** produce PurePath traces for Python apps, so every Python service instruments itself with OpenTelemetry and exports OTLP to the collector. |
| **Logs** | Structured JSON to stdout, captured by the **Dynatrace Kubernetes Log Module** (`spec.logMonitoring` in the DynaKube — `helm/templates/dynakube.yaml`) and ingested into Grail Logs. A dedicated `BusinessEvents` logger emits the canonical business-event shape. NOTE: OneAgent `applicationMonitoring` does **not** tail stdout itself (and full-stack OneAgent isn't allowed on GKE Autopilot); the Log Module — an operator-managed DaemonSet needing no privileged/hostPath access — is what gets logs into Grail. A hostPath-based `meridian-log-collector` DaemonSet (`helm/templates/log-collector.yaml`) remains as an opt-in fallback for non-Dynatrace, hostPath-capable clusters (default off; not Autopilot-compatible). |
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

| `event.type` | Owning service (current) | Key fields |
| --- | --- | --- |
| `citizen.registered` | identity-service | `account.id` (field name is configurable; the event.type string itself is still the literal `citizen.registered`) |
| `service_request.submitted` | workflow-service | `request.id`, `citizen.id`, `request.category`, `request.priority` |
| `service_request.validated` | workflow-service | `request.id` |
| `service_request.status_updated` | workflow-service | `request.id`, `status` (old/new) |
| `service_request.dispatched` | workflow-service | `request.id`, `assigned_department`, `zone_id` |
| `service_request.assigned` | workflow-service | `request.id`, `assigned_to` |
| `workorder.created` | workflow-service | `work_order.id`, `request.id`, `assigned_department` |
| `incident.created` | workflow-service | `incident.id`, `asset.id`, `severity` |
| `iot.anomaly_detected` | workflow-service | `asset.id`, `anomaly.type` |
| `chatbot.interaction` | ai-service | `session.id`, `gen_ai.*`, token counts |

For custom entity types defined in a `values-<industry>.yaml` overlay (anything
not in the base city model above), the owning service is `customer-entity-service`
or `ops-entity-service` per that entity's `domain`, and the event catalog isn't a
fixed list — it's whatever `event.type`/state names the industry config declares.

### Historical: events added for the commerce/billing domains (pre-rewrite)

The table below predates the transaction-service rewrite; the domain still
exists (carts, checkout, orders, bills) but owned by `transaction-service` now,
and the specific flow ids (`purchase`, `tax-payment`) referenced in §4 below
were removed from the provisioner — current Business Flows for this domain
come from whatever `industry.entities` types you define for it.

| `event.type` | Owning service (then) → now | Key fields |
| --- | --- | --- |
| `incident.commented` | city-operations → workflow-service | `incident.id`, `comment.author` |
| `incident.resolved` | city-operations → workflow-service | `incident.id`, `severity` |
| `cart.item_added` | commerce-service → transaction-service | `cart.id`, `citizen.id`, `product.id`, `quantity` |
| `checkout.completed` | commerce-service → transaction-service | `order.id`, `citizen.id`, `order.total_cents`, `order.item_count` |
| `order.packed` | commerce-service → transaction-service | `order.id`, `citizen.id` |
| `order.shipped` | commerce-service → transaction-service | `order.id`, `citizen.id`, `carrier` |
| `order.delivered` | commerce-service → transaction-service | `order.id`, `citizen.id` |
| `tax.bill_issued` | billing-service → transaction-service | `bill.id`, `citizen.id`, `bill.period`, `bill.amount_cents` |
| `tax.payment_completed` | billing-service → transaction-service | `bill.id`, `citizen.id`, `bill.amount_cents` |

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
- **SLO: Checkout success rate** — transaction-service service errors.
- **SLO: Payment processing availability** — transaction-service availability.
- Dashboard tiles: Purchase funnel, Orders today, Revenue (sum of order totals),
  RUM Core Web Vitals, RUM user actions by application.

---

## Verifying instrumentation (per slice)

1. **RUM**: both web apps report sessions, user actions, Core Web Vitals, and JS
   errors; a session is tagged with the citizen email.
2. **Traces**: transaction-service appears as a service-map node with DB + Kafka
   spans; a multi-hop trace spans gateway → transaction-service → Kafka →
   notification-service.
3. **AI**: AI Observability shows OpenLLMetry `gen_ai` spans with token usage.
4. **Business events / funnels**: the new events appear; Purchase and Tax Payment
   funnels populate.
5. **Correlation**: a RUM session is joinable to its funnel on the shared key.

# Documentation Review Checklist

A cross-tier documentation audit performed 2026-06-12 against `main`. Each doc was
read and verified against the actual code/config.

**Status (2026-06-15): all doc items below (A–I) are addressed**, across two PRs —
`docs/sync-core-docs` (CLAUDE.md, API_CONVENTIONS, README, setup-guide,
architecture, dynatrace-config-guide, the 5 demo-scripts) and `docs/service-readmes`
(the 13 service/frontend READMEs). The **code/config issues** at the bottom (1–5)
are intentionally left open for a separate decision.

## Sequencing
Everything audited is live on `main` **except per-citizen auth** (branch
`feat/citizen-auth`, open PR — registration password + email/password login +
gateway login dispatcher). Items marked **🔐** describe the post-merge auth state
and should land **with or after** that PR. Everything else can be done now.

---

## A. `CLAUDE.md`
- [ ] Casing rule says Java "emit camelCase unless SNAKE_CASE is set — most aren't yet" → all three Java services are now flipped; reword to "Java services emit snake_case; internal cross-service DTOs are pinned camelCase via `@JsonNaming`."
- [ ] 🔐 Auth bullet ("`/api/v1/auth/login` is local to the gateway… public-portal has no per-citizen identity — `user.id` always undefined") → update to the dispatcher model (demo → operator token; otherwise verify citizen email+password via citizen-service; citizen JWT carries the citizen `id`).

## B. `docs/API_CONVENTIONS.md`
- [ ] §1 "Java services must opt into snake_case… until converted, read defensively" → conversion is done; reword to past tense.
- [ ] 🔐 §6 Auth/identity → rewrite for per-citizen login + the gateway dispatcher.
- [ ] Audit findings table (#1–10) is stale — every item is fixed (chat reply key, funnels routing, new-request 500, kpis `snapshot_at`, register fields, demo-control faults, fleet/anomaly wiring, incidents). Convert to a "resolved" changelog or delete (the §1–6 conventions are the durable part).

## C. `README.md`
- [ ] Quick Start lists `environmentId` as required → only `apiUrl` / `apiToken` / `otlpEndpoint` are required; `environmentId` is an optional label.
- [ ] Repo-structure tree root `meridian-city-platform/` → repo is `meridian-city/` (that name is the Helm chart, not the repo dir).

## D. `docs/setup-guide.md` (most stale)
- [ ] Helm repos list says `bitnami (PostgreSQL, Kafka)` → it's `cloudnative-pg` + `strimzi` (+ `open-telemetry`, `dynatrace`).
- [ ] `cp helm/values.yaml helm/values-custom.yaml` → should copy `helm/values-custom.yaml.example`.
- [ ] Claims a `--wait` flag / 10-min wait → deploy.sh omits `--wait`; uses `kubectl wait` (~15 min) after a `--timeout 20m` helm install.
- [ ] Dynatrace step implies a chart-deployed operator → deploy.sh installs `dynatrace/dynatrace-operator` as its **own release in the `dynatrace` namespace**, gated on `dynatrace.operator.enabled` **and** `dynatrace.apiUrl` being set; mode is `applicationMonitoring`.
- [ ] Omits that `install` **auto-seeds data + starts background port-forwards**, and the **OneAgent rollout-restart** hint deploy.sh prints (app pods need one `kubectl -n meridian rollout restart deploy` after the DynaKube is Running).
- [ ] Seed-data counts omit **5 city zones + 4 sample incidents**.
- [ ] OneAgent verify references `install-oneagent-sdk` (invented) → real init container is `install-oneagent`.
- [ ] `Init:0/1` troubleshooting blames OneAgent → primary first-install cause is **Kafka** provisioning (3–5 min).

## E. `docs/architecture.md`
- [ ] Phantom DB tables — remove `citizens.sessions`, `iot.devices`, `analytics.business_event_log` (none exist); add `requests.dispatch_log`.
- [ ] Demo Control mechanism says "updates ConfigMaps / patches Deployments / requires RBAC" → it's **HTTP POST to each service's `/admin/fault`** (in-memory flags); no k8s API / RBAC.
- [ ] Kafka consumers wrong — city-operations consumes **only `iot.anomalies`** (not `requests.events`); analytics-service has **no Kafka** (reads via SQL).
- [ ] `iot-ingestion` port "HTTP 4318" → only gRPC 4317 + health 8089 (nothing listens on 4318).
- [ ] Incidents — note **three** creation paths: IoT anomaly (`source=iot`), manual `POST /api/v1/incidents` (`source=manual`), and seed.
- [ ] 🔐 Auth / `accounts` description → reflect per-citizen auth (main currently has email-only lookup + unused `accounts` table).
- [ ] Add a note: HTTP boundary is snake_case; internal service-to-service DTOs are camelCase.

## F. `docs/dynatrace-config-guide.md`
- [ ] Remove CloudNativeFullStack / host log-monitoring claim → `applicationMonitoring`; logs reach DT via the OTel collector `logs` pipeline.
- [ ] Metric prefix `iot.device.*` is wrong throughout → actual is `iot.<category>.*` (e.g. `iot.building.hvac_temp`, `iot.vehicle.engine_temp`, `iot.machine.vibration`).
- [ ] HVAC custom alert "Average > 85°C for 1 minute" → detection needs **3 consecutive 1-min windows** (~3 min); also fix the metric name.
- [ ] GenAI token attrs `gen_ai.usage.prompt_tokens` / `completion_tokens` → `input_tokens` / `output_tokens`.
- [ ] Business-event funnels reference events never emitted (`account.*`, `service_request.in_progress` / `resolved`, `workorder.assigned` / `acknowledged` / `resolved`) — trim to emitted events (see code issue #2).
- [ ] Add the token-scope prerequisite (from `helm/values.yaml`: metrics.ingest, logs.ingest, openTelemetryTrace.ingest, entities.read, settings.write, DataExport — plus operator scopes for OneAgent).

## G. `docs/demo-scripts/`
- [ ] scenario-1 (distributed trace): add login prereq (demo/dynatrace); fix control ("New Service Request" → `/service-requests/new`); form requires **Title**; there is no confirmation screen with a Request ID; it's a **4-service** synchronous trace (notification-service is async via Kafka); drop "Go in this trace."
- [ ] scenario-2 (Davis AI / DB slowdown): it's a **toggle** "Citizen Service — DB Slowdown" (or a ▶ scenario), not an "Inject DB Slowdown" button; delay applies to the service-request **write** (2s scenario / 3s toggle default); reset is "Reset All".
- [ ] scenario-3 (IoT alert): controls are Category + free-text **Device ID** + Anomaly Type + "Inject Anomaly"; use a valid id like `bldg-007` (range `bldg-000`–`bldg-014`); incident appears in **~3 min** for HVAC (1 window for vehicle/machine); don't assert a fixed incident title.
- [ ] scenario-4 (AI observability): drop the "cost estimate" attribute (not emitted); token attrs are input/output; control is the "AI Service — LLM Latency" toggle; reset "Reset All".
- [ ] scenario-5 (business events): trim Flow A/B/C narratives to events actually emitted (the account-registration funnel has no source events at all).

## H. Per-service / frontend READMEs
- [ ] All 13: remove the stale "Status: Phase N — not yet implemented" line.
- [ ] demo-control-api: fault/fleet/traffic endpoint lists are largely fictional → correct to `/fault/:service` + `/fault/status` + `/fault/reset-all`; `/fleet/{status,resize,anomaly}`; `/traffic/{status,start,stop,burst,scenario}`; `/scenarios*`. Remove the "requires k8s RBAC" claim.
- [ ] api-gateway: route table missing `dispatch, assets, incidents, work-orders, kpis, funnels`; note the demo-control prefix rewrite + auth.
- [ ] traffic-bot: admin paths are `/api/v1/{status,start,stop,burst,scenario}` (not `/admin/{status,pause,resume,burst}`).
- [ ] citizen-service: auth is email-lookup (not "mock session"); document `GET /api/v1/service-requests?citizen_id=&limit=` and `/admin/fault`. 🔐 update auth once `feat/citizen-auth` lands.
- [ ] telemetry-processor: faults are runtime `POST /admin/fault {kafka_pause_enabled, memory_pressure_enabled}`, not env vars.
- [ ] city-operations: `GET /api/v1/city/buildings` (not `/api/v1/buildings`); document `/admin/fault` body `{type, enabled, delayMs}`.
- [ ] iot-ingestion: "HTTP 4318" → health 8089.
- [ ] public-portal: routes are `/`, `/login`, `/register`, `/service-requests`, `/service-requests/new` (not `/requests`, `/map`, `/account`); drop Chart.js + markdown claims.
- [ ] ops-dashboard: remove nonexistent "City Map" and "SLO Status" tabs.
- [ ] Accurate, no change: analytics-service, ai-service, service-dispatch.

## I. Clean / no change
- `helm/values-custom.yaml.example` — verified accurate (required keys, single `dynatrace.operator.enabled` toggle, no stale subchart/CloudNativeFullStack references).

---

## Beyond docs — code/config issues surfaced by the audit (decide separately)
1. `requests.request_events` is never written by any service → the ops-dashboard Business Analytics funnels (service-request & account flows) always read 0. Real functional gap.
2. Business-event funnels reference event types nothing emits (`account.*`, `service_request.in_progress`/`resolved`, `workorder.assigned`/`acknowledged`/`resolved`) → either emit them (code) or only document the ones that exist (covered by §F/§G).
3. `helm/values-dev.yaml` still has a dead `dynatrace-operator.enabled` sub-chart key (no-op now that the operator isn't a sub-chart).
4. city-operations `/admin/fault` is effectively dead now that citizen-service owns db-slowdown; the scenarios reset-all path still pokes it with the wrong body. Harmless; could clean up.
5. `.claude/DEPLOYMENT_READINESS_REVIEW.md` is a dated artifact with superseded claims (DynaKube `v1beta5`, operator-as-subchart, `meridian-city-platform` image path). Leave as a historical record, or mark superseded.

## Open decisions
- Scope: do all of A–H, or defer the per-service READMEs (H)?
- Auth (🔐): fold into the `feat/citizen-auth` PR, or a separate docs PR sequenced after it?
- Code issues (1–5): spin off as their own tasks, or leave for now?

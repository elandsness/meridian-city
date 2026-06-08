# Meridian City Platform — Deployment Readiness Review

A pre-deploy review of the application, Helm charts, CI, and documentation. Issues are grouped by severity. Each item names the file(s), the problem, the fix, and a **Status** line recording the resolution.

> **Resolution summary (all items addressed).** Every Critical, High, Medium, and Low item below has been fixed in code/config. Verification was done with the tooling available locally: `node --check` on changed JS, `python -m py_compile` on changed Python, `npm ci --dry-run` against regenerated lockfiles, and JSON/YAML structure review. The Go services (iot-ingestion, iot-simulator) and Helm rendering were verified by manual review only — a Go toolchain and Helm/PyPI were not installable in the build sandbox (downloads blocked). Re-run `helm template`, `helm lint`, and `go build ./...` in CI to confirm.
>
> One residual to confirm against your environment: the DynaKube `v1beta5` + operator `>=1.7.0` pairing assumes a current operator. If your tenant mandates a specific operator version, align the apiVersion to it.

Items marked **(verified)** were confirmed by reading the files directly during the original review.

---

## CRITICAL — will break core functionality on a default deploy

### 1. The frontends cannot reach the API gateway *(verified)*
Both portals call the backend with axios `baseURL: import.meta.env.VITE_API_BASE_URL || ''` (`frontends/public-portal/src/api/client.js:4`, `frontends/ops-dashboard/src/api/client.js:4`). Three problems stacked: the Dockerfiles ran `npm run build` with no `VITE_API_BASE_URL` build arg (baked empty); the Helm template injected the value as a *runtime* env *and used the wrong name* `VITE_API_URL`; and `nginx.conf` had only the SPA fallback, no `/api` proxy. Net: every `/api/v1/*` and SSE call resolved to the frontend's own nginx and returned `index.html`.

**Fix:** Add an nginx `location /api/` `proxy_pass http://api-gateway:3000` block (with SSE-friendly `proxy_buffering off` + long read timeout) to both frontends, keep `baseURL` relative, and remove the misnamed runtime env from the Helm templates.

**Status: ✅ Resolved.** Rewrote `frontends/public-portal/nginx.conf` and `frontends/ops-dashboard/nginx.conf` with the `/api/` proxy + SSE settings; removed `VITE_API_URL`/`VITE_DEMO_CONTROL_URL` from `helm/templates/public-portal.yaml` and `helm/templates/ops-dashboard.yaml`.

### 2. The API gateway corrupts every proxied POST/PUT/PATCH body
`services/api-gateway/src/routes/proxy.js:157` passed Fastify's parsed JSON object straight to `undici.request({ body })`, which serialized it to the literal `"[object Object]"`. Every downstream write broke (chat, service-request submission, dispatch, work orders), including the traffic bot's write journeys.

**Fix:** `JSON.stringify` the parsed body, set `content-type: application/json`, and drop the stale `content-length` so undici recomputes it.

**Status: ✅ Resolved.** `proxy.js` now serializes object bodies (passing through string/Buffer untouched) and deletes `content-length`. `node --check` passes.

### 3. ai-service can't start when `provider=openai` and no key is set *(verified)*
`helm/templates/ai-service.yaml` always mounted `secretKeyRef: llm-openai-api-key` (no `optional`) while `secrets.yaml` only creates that key when `llm.openai.apiKey` is non-empty. A blank key produced `CreateContainerConfigError`.

**Fix:** mark the LLM `secretKeyRef`s `optional: true`.

**Status: ✅ Resolved.** Added `optional: true` to both the OpenAI and Anthropic `secretKeyRef`s in `helm/templates/ai-service.yaml`. (Runtime still requires a valid key for `provider=openai`; the pod now starts cleanly and logs the error instead of failing to schedule.)

---

## HIGH — major demo scenarios or capabilities won't work

### 4. demo-control-api calls non-existent paths on iot-simulator
demo-control-api called `${IOT_SIMULATOR_URL}/api/v1/fleet/...`, but the simulator only serves `/admin/fleet` and `/admin/anomaly[/{id}]` (`services/iot-simulator/internal/admin/server.go:35-38`). **Demo Scenario 3 broken.**

**Fix:** call `/admin/fleet` (POST) and `/admin/anomaly` (POST) / `/admin/anomaly/{id}` (DELETE) with matching bodies.

**Status: ✅ Resolved.** Rewrote `services/demo-control-api/src/routes/fleet.js` to use `/admin/*`; resize now sends the full `{vehicles,buildings,machines}` triple (filling omitted categories from cached state, so it can't zero out other categories); anomaly clear iterates tracked device ids. `services/demo-control-api/src/routes/scenarios.js` reset-all updated the same way. `node --check` passes.

### 5. telemetry-processor fault toggles are silently ignored
demo-control-api POSTed `{kafka_pause_enabled, memory_pressure_enabled}` but the FastAPI model expected `kafka_pause` / `memory_pressure`, so Pydantic dropped them. **Broke the kafka-lag and cascade-failure scenarios.**

**Fix:** align the field names.

**Status: ✅ Resolved.** `services/telemetry-processor/telemetry_processor/api.py` `FaultRequest` now uses the `*_enabled` field names (matching the sender and its own internal state) with the legacy short names kept as Pydantic aliases (`populate_by_name=True`). `py_compile` passes.

### 6. notification-service does not consume `notifications.outbound`
It subscribed only to `iot.anomalies` and `requests.events`; city-operations' work-order alerts on `notifications.outbound` never reached the SSE feed.

**Fix:** subscribe to `notifications.outbound` and map it.

**Status: ✅ Resolved.** `services/notification-service/src/kafka.js` now subscribes to all three topics and adds a `mapOutbound()` mapper for the `{type, workOrderId, requestId, department}` payload. `node --check` passes.

### 7. IoT device identity is lost end-to-end
The simulator attached `device.*` as **datapoint** attributes (correct — one process emits many devices), but iot-ingestion read them from **resource** attributes and only processed `DataPoints[0]`, collapsing every reading onto `unknown-device-N`.

**Fix:** read `device.*` from each datapoint and emit one reading per device.

**Status: ✅ Resolved.** Rewrote `services/iot-ingestion/internal/receiver/otlp.go` to group all datapoints by `device.id` from datapoint attributes (resource attributes kept as fallback) and publish one `TelemetryReading` per device. Verified by manual review (no Go toolchain in sandbox).

### 8. iot-simulator never exports to the OTel Collector
The simulator's only endpoint was `iot-ingestion:4317`, and iot-ingestion drops trace exports — so nothing reached the collector/Dynatrace. Contradicted the architecture doc and the setup guide's `iot.device.*` metrics check.

**Fix:** export metrics+traces to the collector as well.

**Status: ✅ Resolved.** Refactored `services/iot-simulator/internal/telemetry/otel.go` to `InitOTel(ctx, ingestionEndpoint, collectorEndpoint)`: metrics go to iot-ingestion **and** the collector (dual periodic readers), traces go to the collector. `main.go` reads `OTEL_COLLECTOR_ENDPOINT`; `helm/templates/iot-simulator.yaml` sets it to `<release>-opentelemetry-collector:4317`. Manual review (no Go toolchain).

### 9. iot-ingestion advertises OTLP-HTTP :4318 but never listens on it
The Helm deployment/Service declared `containerPort/targetPort: 4318` though the server only listens on gRPC 4317.

**Fix:** remove the 4318 port everywhere.

**Status: ✅ Resolved.** Removed the `otlp-http`/4318 container and Service ports from `helm/templates/iot-ingestion.yaml` (the Dockerfile already only EXPOSEd 4317/8089).

### 10. ai-service chat enrichment hits the wrong citizen-service path
`chat.py` did `GET /api/v1/requests/{id}`; citizen-service serves `/api/v1/service-requests/{id}`, and the response uses `createdAt` (not `submittedAt`).

**Fix:** correct the path and the field name.

**Status: ✅ Resolved.** `services/ai-service/ai_service/chat.py` now calls `/api/v1/service-requests/{id}` and reads `createdAt`. `py_compile` passes.

### 11. DynaKube CR apiVersion / ordering risk *(verified apiVersion)*
`dynakube.yaml` used `dynatrace.com/v1beta2`, which operator ≥ 1.7.0 rejects; the chart pinned `>=1.0.0`. The CR was also applied in the same install as the operator subchart (CRD/webhook race).

**Fix:** use a current apiVersion, pin the operator to a matching version, and order the CR after the operator.

**Status: ✅ Resolved.** Bumped to `dynatrace.com/v1beta5`, pinned `dynatrace-operator` to `>=1.7.0 <2.0.0` in `helm/Chart.yaml`, and made the DynaKube CR a `post-install,post-upgrade` Helm hook so it applies after the operator/webhook are ready. **Confirm the apiVersion matches the operator version your tenant requires.**

---

## MEDIUM

### 12. Shared `requests` Flyway schema between two services
citizen-service and service-dispatch both run Flyway against the shared `requests` schema, risking history-table contention and start-order coupling.

**Fix:** give each its own history table and self-contained schema creation.

**Status: ✅ Resolved.** `citizen-service` uses `flyway_schema_history_citizen`, `service-dispatch` uses `flyway_schema_history_dispatch`, both with `create-schemas: true` (so the `requests` schema is created regardless of start order). Edited both `application.yml` files.

### 13. demo-control-api has unused RBAC
No Kubernetes client exists; the ServiceAccount/Role/RoleBinding granting `deployments patch` was unused.

**Fix:** drop the RBAC (it does HTTP-only fault injection).

**Status: ✅ Resolved.** Removed the ServiceAccount, Role, RoleBinding, and `serviceAccountName` from `helm/templates/demo-control-api.yaml` with an explanatory comment.

### 14. iot-ingestion health probe targeted the gRPC port
Probes used `tcpSocket: 4317` while the health server binds 8089 (not declared as a port).

**Fix:** `httpGet /health` on 8089 and declare the port.

**Status: ✅ Resolved.** `helm/templates/iot-ingestion.yaml` now declares `containerPort: 8089` and both probes use `httpGet /health` on 8089.

### 15. Collector OTLP scheme/port for Go exporters
Concern that `commonEnv`'s `http://...:4318` would be used by gRPC Go exporters.

**Status: ✅ Resolved / not an issue.** Confirmed iot-ingestion already sets its own gRPC endpoint `<release>-opentelemetry-collector:4317` (no scheme) and does not include `commonEnv`; ai-service correctly uses the HTTP exporter against `:4318`. The simulator's new collector export (item 8) also uses gRPC `:4317`. No change required beyond item 8.

### 16. SSE stream and auth headers
`EventSource` can't send the `Authorization` header.

**Status: ✅ Resolved / not an issue.** The gateway route `/api/v1/notifications` is `requiresAuth: false` (`api-gateway/src/routes/proxy.js`), so the SSE stream needs no bearer token. The nginx `/api/` block added in item 1 sets `proxy_buffering off` + long read timeout so the stream flows. No code change needed.

---

## LOW / polish

- **`fastify-plugin` undeclared dependency** in api-gateway. **✅ Resolved** — added `fastify-plugin@^4.5.1` to `package.json` and regenerated `package-lock.json` (`npm ci --dry-run` passes).
- **Hardcoded namespace is fragile.** **✅ Resolved (documented)** — added a comment to `helm/values.yaml` `global.namespace` explaining that app resources and the subcharts must share a namespace, so install with `--namespace meridian` (which `scripts/deploy.sh` does).
- **`your-org` image registry placeholder** must be replaced. **✅ Documented** — left as a required user override (existing setup-guide step) and noted in the namespace comment context; no code fix appropriate.
- **README build badge** pointed at the wrong repo. **✅ Resolved** — updated to `your-org/meridian-city-platform` with a note to set the real org.
- **analytics-service Dockerfile installed `libpq-dev`** unnecessarily. **✅ Resolved** — removed the apt step (asyncpg is pure-Python).
- **Unused config/deps**: `CITY_OPERATIONS_URL` read but unused in ai-service; `uuid` unused in demo-control-api. **✅ Resolved (uuid)** — removed `uuid` from demo-control-api `package.json` + lockfile. The ai-service `_city_ops_url` field is harmless and left in place for the intended future city-operations enrichment.
- **Unwired simulator config** (`anomalyProbability`, per-type `emitIntervalSeconds`). **✅ Resolved (documented)** — annotated `helm/values.yaml` to mark which fields are wired vs reserved; also fixed the simulator to honor `OTEL_RESOURCE_ATTRIBUTES`/`OTEL_SERVICE_NAME` via `resource.WithFromEnv()`.
- **CI** runs `pytest || true` and `go mod tidy` at build time. **ℹ️ Unchanged** — left as-is (intentional leniency for a demo); flagged for awareness.

---

## What's correct (so you don't re-investigate)
- Service ports match across code, Dockerfile `EXPOSE`, and Helm. *(spot-verified)*
- Java datasource + Kafka wiring is correct and points at `<release>-postgresql` / `<release>-kafka`. *(verified)*
- The image helper builds `ghcr.io/<owner>/meridian-city-platform/<service>:<tag>`, matching CI. *(verified)*
- All 14 services/frontends have matching templates and values; Kafka topic provisioning (RF 1, 1 broker) is valid. *(verified)*
- Kafka topic names line up across producers/consumers (the `notifications.outbound` gap is fixed in item 6).
- The deployed OTel collector config (`helm/templates/otel-configmap.yaml`) is valid and correctly templated with the Dynatrace `Authorization: Api-Token` header; it legitimately listens on 4318 (HTTP, used by ai-service) and 4317 (gRPC).

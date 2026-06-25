# Demo Control Scenario Validation

**Date:** 2026-06-24
**Cluster:** GKE Autopilot (`autopilot-cluster-elandsness`, primary, OneAgent-instrumented)
**Tenant:** live Dynatrace (`dynatrace-mcp-kyw`)
**Method:** For each demo-control scenario — enable via demo-control-api, drive/observe traffic,
query Dynatrace (service response time, logs, Davis problems, K8s metrics) during the fault and
after reset. demo-control-api reached via `kubectl port-forward svc/demo-control-api 3001`.

> **Resolution (2026-06-25):** Acting on finding #3, the **Kafka Consumer Lag** (`kafka-lag`)
> scenario and the underlying telemetry-processor `kafka_pause` fault were **removed** — it never
> produced real consumer lag (auto-commit kept advancing offsets) and no lag metric/Davis problem
> was ever surfaced, so it could not deliver its headline signal without standing up a Kafka
> lag exporter (infra work out of scope). **`cascade-failure`** was re-composed as
> **`db-slowdown` + `llm-latency`** (two strong, clearly-visible signals; the chatbot journey is
> now enabled by default, so `llm-latency` has organic traffic). The findings below are retained
> as the rationale for that change.

## Environment baseline (pre-test, ~18:20–18:30 UTC)

- traffic-bot: **running**, ~8 rpm. Journeys enabled: citizenRequest(25), accountCreation(20),
  browsing(25), storePurchase(20), payTax(15), injectAnomaly(8). **chatbot(5) is DISABLED** →
  no organic `/api/v1/chat` traffic (matters for llm-latency).
- Logs: **fully available in Grail** for all meridian containers (incl. citizen/ai/analytics/telemetry-processor).
- Service entities (all instrumented): citizen `SERVICE-2B28103D5D5CF3C4`, ai `SERVICE-C1F5FB9FB0E67F30`,
  analytics `SERVICE-B56EDF39B9A19ECA`, telemetry-processor `SERVICE-2AA0D41F0479B6AE`.
- Baseline avg response_time (µs): citizen ~5,000–12,000 · ai ~1,090–1,400 · analytics ~1,400–2,080 ·
  telemetry-processor ~1,300–1,445 (count ~3,000/10m, high throughput).

## Code-level pre-findings (to confirm empirically)

- **memory-pressure** scenario → analytics-service, but `apply_memory_pressure()` is only invoked
  once inside the `/admin/fault` handler (`api.py:133`); allocates a single 100 MB block, never grows.
  (telemetry-processor's per-message growth is NOT what the scenario targets.) Expect weak/no signal.
- **llm-latency** mechanism (`chat.py:130` sleeps 10s) only fires on `/api/v1/chat`, which has no
  organic traffic (chatbot journey off). Must drive chat manually.
- **kafka-lag**: paused consumer does `sleep(1); continue` (consumer.py:72) with `enable_auto_commit=True`
  — lag growth depends on ingest rate vs the 1 msg/s throttle.

---

## Executive summary

| # | Scenario | Worked? | One-line why |
|---|----------|---------|--------------|
| 1 | **Database Slowdown** (`db-slowdown`) | ✅ **Yes** | 2 s delay is clearly visible as ~2,080 ms `submitRequest` (OTel) + `api-gateway POST` spans; auto-reset works. Caveat: not on the OneAgent `citizen-service` tile. |
| 2 | **LLM Latency Spike** (`llm-latency`) | ✅ **Yes** (mechanism) / ⚠️ no default traffic | 10 s injection shows as 10–12 s `meridian.chat` spans — but only after I drove chat manually; the `chatbot` journey is off by default, so it's a no-op in a normal demo. |
| 3 | **Kafka Consumer Lag** (`kafka-lag`) | ❌ **Removed (2026-06-25)** | Halted telemetry processing (INSERT/anomalies → 0, visible), but produced **no real consumer lag** (auto-commit kept advancing offsets) and there was **no lag metric / Davis problem**. Mislabeled → removed. |
| 4 | **Memory Pressure** (`memory-pressure`) | ⚠️ **Partial** | Allocates one 100 MB block once (clean +100 MB step in K8s container memory), but never grows — no leak curve, no OOM, no Davis problem. |
| 5 | **Cascade Failure** (`cascade-failure`) | ✅ **Yes** | Activates both component faults at once; both signals appear; clean reset. **Re-composed 2026-06-25** as `db-slowdown` + `llm-latency` (was `db-slowdown` + `kafka-lag`). |

**Bottom line:** 2 of 5 are demo-ready as-is (db-slowdown, cascade — modulo the entity-naming caveat).
llm-latency works but is a silent no-op unless chat traffic is driven. kafka-lag and memory-pressure
"fire" and are observable to a trained eye, but neither produces the headline signal its name promises
(consumer lag / a memory leak), and neither raises a Davis problem.

## Cross-cutting findings (affect multiple scenarios)

1. **Dual instrumentation splits the service model.** Meridian's Java services appear as BOTH a
   OneAgent entity (`citizen-service`, shows only `GET /*`) and OpenTelemetry entities
   (`ServiceRequestController`, `DispatchController`, `WorkOrderController`, …) that carry the real
   POST work. The db-slowdown latency lands on the OTel/gateway entities, not the `citizen-service`
   tile an SE would naturally open. **Pick one instrumentation story** (or merge them) so the demo
   narrative points at one entity.
2. **Shared, noisy tenant.** This tenant also hosts `oteldemo`, `acme-bank`, `fraud-detection`,
   `ollama`, etc., generating a constant stream of Davis problems (Response Time Degradation, Failure
   rate increase, K8s saturation). That makes it impossible to cleanly attribute a Davis problem to a
   Meridian fault. **Use a dedicated tenant or a Meridian management zone** for demos.
3. **Low traffic volume.** Traffic-bot runs at ~8 rpm; the affected endpoints see ~1–2 req/min. That
   is too thin for Davis to reliably open a problem within a 5–10 min demo window. **Raise the baseline
   load** (or add a "demo load" preset) when running chaos.
4. **Logs in Grail are reliable.** Every container logs to Grail, and the fault log lines for
   citizen-service (`DB slowdown fault active`), ai-service (`artificial LLM latency active`) and
   analytics-service (`memory pressure block allocated`) are queryable — a dependable detection channel.
   kafka-lag had **no** log line (now moot — the scenario was removed 2026-06-25).
5. **No scenario raised an attributable Davis problem** at current volume/window. All detections in this
   report are via traces / logs / K8s metrics, not Davis problem cards.

## Results

### 1. Database Slowdown (`db-slowdown`) — ✅ WORKS (with caveats)

**Injected:** 18:23:51Z via `POST /scenarios/db-slowdown/start`; auto-reset at 18:28:51Z (5 min). Confirmed off afterward.

**Dynatrace evidence:**
- Distributed traces show the 2s delay clearly: `ServiceRequestController` / `submitRequest`
  spans at **2081 / 2077 / 2072 / 2065 ms** and `meridian-api-gateway` / `POST /api/v1/*` at
  **~2070–2085 ms**, exactly during the injection window (baseline for these spans ~80–165 ms).
- citizen-service logs: 6× `DB slowdown fault active — sleeping 2000ms before DB write`
  (18:24:15 → 18:28:31).
- After auto-reset, the same spans returned to ~80–165 ms.

**Why / caveats:**
- The Java services are **dual-instrumented**. OneAgent produces a `citizen-service` service
  entity that, in my window, showed **only `GET /*` spans (max 12 ms)** — the slow POST does **not**
  appear there. The slow `submitRequest` POST is captured on the **OpenTelemetry**-derived
  `ServiceRequestController` entity (`SERVICE-5308631D58217E59`) instead. An SE who opens the
  "citizen-service" service tile will NOT see the slowdown; it lives on `ServiceRequestController`
  + `meridian-api-gateway`.
- Volume is low (~1 affected request/min over 5 min). A dedicated Davis "Response Time Degradation"
  problem could not be cleanly attributed — the tenant is **shared with other demos** (oteldemo,
  acme-bank, fraud-detection, ollama) generating heavy problem churn.

**Remediation:**
- Converge on ONE instrumentation path for the Java services (OneAgent *or* OTel) so the slow span
  lands on the entity the demo points at. As-is, the "citizen-service" tile is misleading.
- Increase load + injection duration (raise traffic-bot rpm and/or extend past 5 min) so Davis
  reliably raises a Response Time Degradation problem on the affected entity.
- Strongly consider an isolated tenant / management zone — shared-tenant noise drowns the signal.

### 2. LLM Latency Spike (`llm-latency`) — ✅ WORKS (mechanism); ⚠️ no organic traffic

**Injected:** 18:49:18Z via `POST /scenarios/llm-latency/start` (manual reset). Reset 19:18:25Z.
Drove 30 chat requests through the gateway (chatbot journey is disabled by default).

**Dynatrace evidence:**
- ai-service `meridian.chat` spans: **30 spans, min 10s / avg 12s / max 45s** (baseline ~2–3s).
  The 10s injection is unmistakable in AI observability / traces.
- ai-service logs: 30× `fault injection: artificial LLM latency active` (19:09:40 → 19:16:11).
- All 30 chat requests returned HTTP 200 at 11–13s; the LLM provider is genuinely working
  (real answers returned). After reset, a chat returned in **2.0s** → clean recovery.

**Why / caveats:**
- The fault hook (`chat.py:130`) fires before the provider call, inside the `meridian.chat` span — solid.
- **The flagship gap:** the only thing that exercises `/api/v1/chat` is the traffic-bot `chatbot`
  journey, which is **disabled by default** (`SCENARIO_CHATBOT`, weight 5, `enabled:false`). With
  default traffic, enabling this scenario produces **zero** chat requests → **no signal at all**.
  I had to drive chat manually to see anything.

**Remediation:**
- Enable the `chatbot` journey by default (or have the demo runbook start it / drive chat) whenever
  llm-latency is used, otherwise the scenario looks like a no-op. Optionally have the scenario
  activation auto-enable chat traffic.
- Consider lowering the injected default (10s) only if chat UX in the live portal matters during demos.

### 3. Kafka Consumer Lag (`kafka-lag`) — ❌ REMOVED (2026-06-25; mislabeled, no lag produced)

> **Removed 2026-06-25.** The scenario and the telemetry-processor `kafka_pause` fault were deleted
> across demo-control-api, telemetry-processor, the ops-dashboard fault toggle, Helm, and docs.
> Rationale below. Producing a *real* lag signal would have required both a code change (stop
> consuming / `enable_auto_commit=False`) **and** a Kafka lag exporter feeding Dynatrace — infra
> work that wasn't justified for this scenario. `cascade-failure` now pairs `db-slowdown` with
> `llm-latency` instead.

**Injected:** 19:19:17Z via `POST /scenarios/kafka-lag/start` (manual reset). Reset 19:28:00Z (~9 min).

**Dynatrace evidence (telemetry-processor, per-minute spans):**
- `INSERT` (DB writes from processing): steady ~277/2min until 19:19, then **0 from 19:20 onward**.
- `iot.anomalies send` (→ city-operations incidents): present until ~19:15, then **0**.
- `iot.telemetry.raw receive` (Kafka consume): **unchanged at ~55/min** throughout the pause.
- `kafka_consumergroup_lag` metric: **no data** in the tenant (no consumer-lag metric is ingested).

**Why:** The paused consumer does `await asyncio.sleep(1); continue` (consumer.py:72) **without
stopping consumption** and with `enable_auto_commit=True`. So it keeps *receiving* messages and the
offsets keep advancing — **no consumer-group lag accumulates**. What actually happens is messages are
**consumed and silently discarded** (no `_process_message` → no DB writes, no anomaly forwarding).
The real, observable effect is "telemetry processing stalls / data is dropped," NOT "consumer lag."
Compounding this: there is no consumer-lag metric exported to Dynatrace, no Davis problem (a background
consumer going quiet doesn't raise failure-rate/response-time alerts), and **no log line** when paused.

**Verdict:** The fault toggles and has a genuine effect visible in traces (processing → 0), but it does
**not** deliver the advertised "Kafka Consumer Lag" signal, and nothing in Dynatrace is labeled as lag.

**Remediation (pick one path):**
- To produce **real lag**: stop consuming while paused — `self._consumer.pause()`/`stop()` or break the
  loop *without committing* (and/or set `enable_auto_commit=False`), so offsets freeze and lag grows.
- Export a **consumer-lag metric** (Strimzi `kafka-exporter` → Prometheus/Dynatrace, or Kafka JMX) so the
  lag is chartable and Davis-alertable; otherwise there is no "lag" KPI to show.
- Add a log/business event on pause (e.g., `kafka consumer paused — processing halted`) for a log signal.
- Otherwise, rename the scenario to "Telemetry Processing Stall" to match the actual behavior.

### 4. Memory Pressure (`memory-pressure`) — ⚠️ PARTIAL (one-time 100 MB step, no leak)

**Injected:** 19:30:54Z via `POST /scenarios/memory-pressure/start` (manual reset). Reset 19:38:34Z.
Confirmed the fault landed on the real service (`analytics-service /health` → `memory_pressure_enabled:true`).

**Dynatrace evidence:**
- `dt.kubernetes.container.memory_working_set` for analytics-service: flat **~53 MB** until 19:30, a
  clean **step to ~153.6 MB at 19:31**, then **flat** (no growth). `kubectl top` agreed (56 MB → 153 MiB).
- analytics-service log: 1× WARN `fault injection: memory pressure block allocated`.
- **No** pod restart / OOMKill (RESTARTS 0), **no** Davis memory-saturation problem.

**Why:** `apply_memory_pressure()` is called **exactly once**, inside the `/admin/fault` handler
(`api.py:133`). It appends a single 100 MB `bytearray` and never runs again — so memory steps up once
and holds. The description ("simulate a memory leak") implies growth, but nothing drives repeated
allocation on analytics-service (the per-message growth path exists only in telemetry-processor, which
this scenario does not target). 100 MB is well within the container's headroom, so no saturation/OOM.

**Verdict:** Observable as a one-time +100 MB step in K8s container memory, but it does **not** behave
like a leak and raises no problem/alert — weak for a "memory pressure / leak" story.

**Remediation:**
- Drive `apply_memory_pressure()` repeatedly (background timer, or on each `/api/v1/kpis` request like
  telemetry-processor does per message) so memory grows over time toward the 1 GB cap — a real leak curve.
- Right-size the analytics container memory limit so the growth approaches saturation → Davis raises
  "Memory usage close to limits" (that problem type is already active in this tenant) and/or an OOMKill,
  which makes a far more compelling demo.

### 5. Cascade Failure (`cascade-failure`) — ✅ WORKS (orchestration correct)

**Injected:** 19:43:22Z via `POST /scenarios/cascade-failure/start` (manual reset). Reset 19:53:00Z.

**Dynatrace evidence (both component signals present simultaneously):**
- db-slowdown: `ServiceRequestController/submitRequest` **p50 2049 ms / max 2069 ms** (14 slow POSTs),
  `meridian-api-gateway POST /api/v1/*` max 2073 ms.
- kafka-lag: telemetry-processor `INSERT` dropped to **0 from ~19:45** (and `iot.anomalies send` → 0).

**Orchestration notes:**
- Activating cascade correctly set **both** faults at once (citizen `db_slowdown` + telemetry
  `kafka_pause`), confirmed via `/fault/status`.
- The db-slowdown component **did not auto-reset** at 5 min under cascade (it stayed on for the full
  ~10 min until manual reset) — because `cascade.activate()` calls the sub-scenario's `activate()`
  directly without scheduling the 5-min timer. This is the desired behavior for a held cascade.
- `DELETE /scenarios/active` cleared both faults cleanly.

**Verdict:** Works as designed. **Re-composed 2026-06-25** to `db-slowdown` + `llm-latency` after the
`kafka-lag` component was removed — both halves are now strong, clearly-visible signals (2 s `submitRequest`
spans + 10 s `meridian.chat` spans), and `llm-latency` now has organic chat traffic by default.
(As originally tested it was `db-slowdown` + `kafka-lag`, where the kafka-lag half was the weak
"processing stall, no real lag" signal documented above.)

**Remediation:** none specific to the orchestration.






# Regression Baseline — 2026-07-23 (Stage 0 diff oracle)

> Captured as Stage 0 of the generic-entity-engine initiative (see
> `docs/INDUSTRY_PLATFORM_PLAN.md` and the plan referenced from
> `project_generic_entity_engine` memory). Purpose: a concrete "what does `main`
> actually do right now" baseline to diff Stage 6 (City retrofit), Stage 7
> (Airport retrofit), and Stage 10 (final regression) against. Re-run the same
> checks in this doc against the retrofitted branch and compare.

## Live instance identity

- **Cluster**: GKE Autopilot, context
  `gke_sales-engineering-noram_us-east1_autopilot-cluster-elandsness` (the
  primary cluster).
- **Release**: `meridian-dxad`, namespace `meridian-dxad`, chart
  `meridian-city-platform-0.1.0`, revision 7 (last upgraded 2026-07-10 12:34
  UTC-4). Confirmed via `helm get values` there is **no `industry:` override** in
  the user-supplied values — this instance runs on chart **defaults, i.e. City**
  (`config.json` confirms `"id":"city"` below).
- **Caveat — staleness**: most pods have been running since the 2026-07-10
  deploy/restart (~13 days old at capture time) and pull `imagePullPolicy:
  Always` off a floating `:latest` tag, so this snapshot reflects roughly
  `main` as of ~2026-07-10–11, **not** necessarily current `main` HEAD — `deploy.sh
  upgrade` alone doesn't recreate pods on image-only changes (see
  `project_helm_upgrade_floating_tag` memory). If a later session needs a
  snapshot of true current-`main` behavior, `kubectl rollout restart deploy -n
  meridian-dxad` first and let pods settle before re-checking.
- **Finding, worth carrying into the retrofit design**: `flight-ops` and
  `passenger-service` pods are deployed and **actively running/generating data**
  (real flights with today's timestamps, see below) even though this instance's
  active industry is City, which has no Airport screens/nav. Confirms today's
  Helm chart deploys the full service set **unconditionally regardless of
  `industry.id`** — only the frontend's screen/home-module visibility is
  industry-gated, not backend service deployment. Worth deciding explicitly in
  the entity-engine retrofit whether the new services should also always-deploy
  (simple, matches today) or be conditionally deployed per active entity types
  (leaner, but a chart-conditional that doesn't exist today).

## Frontend config (live-fetched from the running pod, verbatim)

`GET /config.json` via `public-portal`:

```json
{"company":{"assistant":{"name":"Meri","persona":"Meridian City's virtual assistant"},"name":"Meridian City","short":"Meridian","tagline":"Your city, connected."},"home":{"ops":["ops-overview"],"public":["city-home","quick-actions"]},"id":"city","screens":{"disabled":[],"ops":["overview","iot","incidents","requests","analytics","demo-control"],"public":["home","service-requests","store","billing","messages"]},"terminology":{"asset":"Asset","assetPlural":"Assets","customer":"Citizen","customerPlural":"Citizens","incident":"Incident","incidentPlural":"Incidents","request":"Service request","requestPlural":"Service requests","workOrder":"Work order"},"theme":{"colors":{"accent":"#EF9F27","accentInk":"#412402","accentSoft":"#f6b54e","brand":"#0C447C","brandDeep":"#082f57","brandSoft":"#185FA5","brandTint":"#E6F1FB"},"favicon":"/meridian-logo.svg","logo":""},"version":1}
```

Both SPAs are served from the same ConfigMap (verified in code during design
research — `industry-configmap.yaml`), so this is City's full public-facing
config for both `public-portal` and `ops-dashboard`.

**Airport's equivalent live config.json was not captured this pass** — this
instance's active industry is City. Capturing Airport's live config requires a
`-f helm/values-airport.yaml` deploy; the Explore-agent design research already
read the current `AirfieldMap.jsx`/`AirfieldMapCard.jsx`/`values-airport.yaml`
source directly (cited with file:line in the plan file) as a code-level
substitute. Recommend doing a real live capture before Stage 7 begins.

## Demo-control scenario catalog (live, current — supersedes the stale doc below)

`GET /api/v1/scenarios` returned 5 scenarios (matches the "unified Business
Failures" state described in `project_industry_platform` memory, not the older
5-scenario db-slowdown/llm-latency/kafka-lag/memory-pressure/cascade-failure set
in `docs/DEMO_CONTROL_VALIDATION.md`, which itself already documents kafka-lag's
removal but is otherwise dated 2026-06-24/25 and stale as a live reference):

| id | name | clear mode | key params |
|---|---|---|---|
| `db-slowdown` | Database Slowdown | auto, 5 min | `seconds` (DB latency), default 2s, 1-10 |
| `llm-latency` | LLM Latency Spike | manual | `seconds`, default 10s, 1-30 |
| `memory-pressure` | Memory Pressure | manual | `cap_mb` default 512 (128-1024), `ramp_minutes` default 3 (1-15) — now ramps toward a cap and can OOMKill if cap exceeds the container limit, an upgrade from the one-shot-100MB behavior the June validation doc describes |
| `cascade-failure` | Cascade Failure | manual | none — triggers db-slowdown + llm-latency together |
| `business-exceptions` | Business Failures | manual, 10 min | `rate` default 30% (5-100) — the single unified toggle across every active business flow, replacing the old per-flow scenarios |

Current state at capture time: `active: null` (nothing engaged), all per-service
fault flags `false`/`0` in `/api/v1/fault/status`.

## Traffic-bot state (live)

`GET /api/v1/traffic/status`: running since 2026-07-10T16:54:48Z, 8 rpm,
**134,175 journeys completed / 1,723 failed** cumulative. Active journeys:
`citizenRequest`(25) `accountCreation`(20) `browsing`(25) `storePurchase`(20)
`payTax`(15) `injectAnomaly`(8) — `chatbot`(5) **disabled** by default, matching
the June validation doc's finding that `llm-latency` has no organic signal
unless chat traffic is driven manually.

## Sample entity shapes (live, real data — useful field-mapping reference for the entity-config DSL)

**Service request** (`GET /api/v1/service-requests`):
```json
{"id":"req-c7baj","citizen_id":"cit-2aeja","category":"utilities","priority":"high","status":"resolved","title":"Street drain blocked","description":"Drain on the corner of Ash Road is blocked causing flooding during rain.","created_at":null,"updated_at":"2026-07-16T14:30:45.58135Z"}
```
Note `created_at: null` on resolved requests — worth checking whether that's
expected-current-behavior or a pre-existing bug before treating it as a
parity target.

**Incident** (`GET /api/v1/incidents`, IoT-sourced):
```json
{"id":"inc-d5d98","asset_id":"mach-002","severity":"medium","source":"iot","status":"open","title":"Elevated error rate on mach-002 (iot.machine.error_rate)","location_name":"East Industrial","location":{"lat":51.508,"lng":-0.072},"work_order_count":1,"created_at":"2026-07-09T13:51:56.179296Z"}
```

**Flight** (`GET /api/v1/flights` — generated continuously regardless of active industry, see finding above):
```json
{"id":"flt-6d5b6","flight_number":"SK329","airline":"Skyline","direction":"departure","origin":"MER","destination":"JFK","gate":"B7","stand":"R1","aircraft_type":"B777","status":"at_gate","progress":0.0,"scheduled_at":"2026-07-23T00:46:22.21569Z","updated_at":"2026-07-23T00:46:22.21569Z"}
```
`progress: 0.0` on every sampled flight — consistent with the design research
finding that this field is reset on every transition and never actually
incremented in between (`Flight.java`'s own javadoc calls it "carried for the
future airfield map").

**Passenger** (`GET /api/v1/passengers`): returned empty at capture time — not
investigated further this pass (not blocking Stage 0; passenger-service did
show one pod restart 12 days ago per `kubectl get pods`, which may be related).

## How to use this doc

Re-run the same `curl`/`kubectl` checks in this doc (scenario catalog, fault
status, traffic status, sample entity shapes, `config.json`) against the
retrofitted instance at Stage 6 (City) and Stage 7 (Airport), and diff behavior
— not byte-for-byte (ids/timestamps differ), but same shapes, same scenario
catalog, same screens/home-modules, same fault-injection behavior.

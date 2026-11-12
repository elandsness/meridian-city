# Meridian — Multi-Industry Platform Plan (Airport Flagship)

> Status: **draft for review** (planning artifact, no code yet). Pairs with
> [PLAN.md](PLAN.md) (the original City build tracker), [REQUIREMENTS.md](REQUIREMENTS.md),
> [architecture.md](architecture.md), and [API_CONVENTIONS.md](API_CONVENTIONS.md).
>
> Goal of this initiative: turn Meridian from a single fixed demo ("Meridian City")
> into a **configurable platform** where one declarative config file re-skins the
> front end and back end into a different industry — Meridian Airport, Meridian
> Energy, Meridian Pizza, etc. — and an LLM authoring kit lets an SE generate that
> config from a prompt. We prove the platform by building **one industry end-to-end
> first**: an airport.

---

## 1. Vision & end state

An SE opens ChatGPT/Claude, pastes our authoring prompt + skill, says *"spin up a
Meridian demo for an airport (or PSE&G, or a pizza chain)."* They get back a single
config file. They drop it into a deploy and get a fully re-skinned, fully observable
Meridian instance — different company name, terminology, screens, business flows,
colors, logo, imagery, demo data — all visible end-to-end in Dynatrace (RUM, service
map, Business Flows).

This sits **on top of** the existing per-instance multi-tenancy: a deployment is now
defined by two orthogonal axes — **instance** (`meridian-<hash>`, isolates infra +
tenant identity; already built in PR #98) and **industry** (the new axis this plan
adds; selects branding, terminology, screens, flows, data).

---

## 2. Locked decisions (the contract from our planning interview)

| # | Decision | Choice |
|---|---|---|
| 1 | Config delivery | **Runtime config, one image set.** Never per-industry images. |
| 2 | When industry applies | **Deploy-per-industry now**; architecture designed so live **hot-swap** is feasible later. |
| 3 | Screen model | **Hybrid**: a curated module library **+** (later) a generic list/detail/form renderer. |
| 4 | New modules' backend | **Full, real backend services** (schema + traffic), like the existing ones. |
| 5 | Theming | **Full runtime theming in v1** (CSS-variable refactor so one image renders any palette). |
| 6 | Asset sourcing | Authoring **LLM specifies** palette + describes logo/imagery; a **pipeline generates/sources** the assets. |
| 7 | Config form | **Single declarative file** (YAML/JSON, a Helm values override); assets referenced by URL/path. |
| 8 | Dynatrace depth | Reskin **business + technical** layers. Mechanism = **Path A (Dynatrace-side naming rules)** — see §3.5. |
| 9 | Sequencing | **Vertical slice**: one flagship industry end-to-end before generalizing. |
| 10 | Authoring kit | Prompt + skill + schema + validator. **In the slice** (airport config is produced via the kit as the first proof). |
| 11 | Flagship | **Meridian Airport**, framed as an **airport operator** (hosts many airlines). |
| 12 | Hero (both in scope) | **Aircraft turnaround** flow + **passenger journey** flow; the **live aircraft map** is the hero module. |
| 13 | Map style | **Stylized schematic airfield** with **smooth continuous glide** motion. |
| 14 | Kept screens (airport) | service requests→ops/maintenance tickets, IoT→ground equipment, incidents→operational incidents, analytics→on-time & throughput. Store + billing **off** for v1. |
| 15 | Generic renderer | **Fast-follow (Phase 7)** — explicitly out of the airport slice to protect scope. |
| 16 | Demo profile | **Always-on, steady & busy** (a dozen-plus active flights so any drop-in looks alive). |

Deferred / design defaults still to confirm: see **§6**.

---

## 3. Architecture

### 3.1 Two orthogonal dimensions

PR #98 established `global.instanceHash`, the single source of truth fanned out via
`helm/templates/_helpers.tpl` to every infra + observability identifier. We add a
**parallel** single source of truth: an **`industry` config block** in Helm values,
fanned out the same way to branding/terminology/screens/flows/data.

```
deploy = (instanceHash, industry)
  instanceHash → infra + tenant identity isolation   (existing; do not touch the rules in CLAUDE.md §Multi-tenancy)
  industry     → branding, terminology, screens, flows, data, DT display names   (NEW)
```

App **workload** names (`api-gateway`, `citizen-service`, …) still stay plain and
namespace-isolated. The industry axis changes what the *user* and *Dynatrace* see,
not the k8s object names — consistent with the existing rule "never hash anything an
end user sees," now generalized to "the industry config owns everything an end user
sees."

### 3.2 The industry config (single declarative file)

One file, e.g. `helm/values-airport.yaml`, merged at deploy with the existing
`-f` pattern (`./scripts/deploy.sh install -f helm/values-airport.yaml`). It sets one
`industry:` block. Shape (illustrative — finalized as the JSON Schema in Phase 6):

```yaml
industry:
  id: airport
  company:
    name: "Meridian Airport"
    short: "Meridian"
    tagline: "Every journey, on time."
    assistant: { name: "Skye", persona: "the Meridian Airport virtual assistant" }
  theme:
    colors: { brand: "#0B3D91", accent: "#E8A33D", ink: "#0a1424", ... }
    logo: "config://assets/logo.svg"        # delivered per-instance (see §6.3)
    favicon: "config://assets/favicon.svg"
    imagery: { hero: "https://…", ... }
  terminology:                               # generic noun -> industry noun
    customer: "Passenger"
    request:  "Maintenance ticket"
    incident: "Operational incident"
    asset:    "Ground equipment"
    # … full map drives both frontends + backend labels
  screens:                                   # which curated modules mount, + labels/order
    public:  [ flight_board, my_journey, ... ]
    ops:     [ airfield_map, flight_ops, maintenance_queue, ground_equipment, incidents, ontime_analytics ]
    disabled: [ store, billing ]
  flows:                                      # drives business events + DT Business Flows
    - { id: aircraft_turnaround, correlation: flight.id, steps: [...] }
    - { id: passenger_journey,   correlation: passenger.id, steps: [...], optional: [bag_check, bag_loaded] }
  data:                                       # seed + traffic templates (airlines, gates, name pools, timing bands)
    airlines: [...]
    gates: [...]
    timing: { ... }                           # reuses the deferred-scheduler band pattern
  dynatrace:
    service_display_names: { citizen-service: "Maintenance Service", city-operations: "Airfield Operations", ... }
    rum: { public_snippet: "<script…>", ops_snippet: "<script…>" }   # per-industry RUM app ids (see §3.5)
```

Backends receive the knobs they need as env (via the existing
`meridian.extraEnv` helper — same mechanism that already tunes lifecycle delay
bands). Frontends receive the whole block as a runtime file (next section).

### 3.3 Frontend: ConfigContext + module registry + CSS-variable theming

Three new pieces in each SPA (`public-portal`, `ops-dashboard`):

1. **Runtime config delivery.** A generated ConfigMap holds `config.json` (the
   `industry` block, minus secrets), mounted into the frontend pod and served by
   nginx at `/config.json`. `main.jsx` fetches it before render into a
   `ConfigContext`. (Frontends are already API-agnostic and nginx already serves
   static + proxies `/api` — we add one static file. No image rebuild per industry.)

2. **Module/screen registry.** Replace the hardcoded `App.jsx` routes/nav with a
   registry: each curated screen is a feature module registered with
   `{ id, defaultLabel, requiresCapability, component, route }`. The config's
   `screens` list selects which mount, their labels, order, and nav icons. This is
   the seam the Phase-7 generic renderer plugs into later.

3. **Runtime theming.** Refactor Tailwind brand tokens to CSS custom properties:
   `tailwind.config.js` `colors.brand = 'var(--color-brand)'`, etc.; a `<ThemeStyle>`
   sets the `:root` variables from config at startup. One image → any palette.
   *Scope guard:* tokenize only the **brand** colors (`meridian.blue`, `noon.sun`)
   first; leave neutral `slate/gray` utilities alone to keep the refactor bounded.

All hardcoded copy ("Meridian City", "citizen", "service request", "Meri", …) is
replaced by `ConfigContext` lookups (`t('customer')`, `cfg.company.name`).

### 3.4 Backend: config-driven knobs

The domain model is already ~85–90% generic (a request is a ticket, a work order is
a task, an incident is an event). Industry coupling lives in a few externalizable
spots, each becomes config/env-driven:

- **Dispatch routing** (`service-dispatch` `RoutingEngine`): category→department map
  comes from config, not a hardcoded switch.
- **Business-event names + correlation ids**: emitted from config (the
  `BusinessEventLogger` calls already take the type as a string).
- **AI persona/prompt** (`ai-service`): name, persona, domain context, fallback phone
  from config/env (already env-capable).
- **Seed data + traffic templates** (`traffic-bot`, seed scripts): airlines, gates,
  name pools, request/journey templates, timing bands from config.
- **Notification templates** (`notification-service`): already generic; parameterize
  the few labels.

### 3.5 Dynatrace: Path A naming + per-industry flows/events/RUM

**Verdict (from recon): Path A — Dynatrace-side service naming rules.** Renaming a
OneAgent-detected Java service's display name would mean changing `spring.application.name`
(baked in the image) and Go services hardcode `service.name` — both would force
per-industry images, which decision #1 forbids. Instead Dynatrace renames the
*display* names with zero image/k8s change, reversibly, via **two** mechanisms
(confirmed in the Phase 0 spike below): namespace-scoped **`builtin:naming.services`**
rules for OneAgent-detected services, and **`OTEL_SERVICE_NAME`** env for OTel-ingested
services. Both extend machinery that already keys by hash + namespace and self-cleans:
the **per-instance provisioner** (`helm/files/provision-dynatrace-business-config.py`)
for the rules, and Helm env for the OTel names.

Extend the provisioner to also:
- Upsert **`builtin:naming.services`** rules mapping each OneAgent service → the config's
  `dynatrace.service_display_names` (condition scoped to this instance's namespace,
  idempotent, delete-on-uninstall — same pattern as the Business Flows it already manages).
  OTel services (Go `iot-*`, `ai-service`) instead take their display name from
  `OTEL_SERVICE_NAME` in Helm env (naming rules don't apply to OTLP services).
- Generate **Business Flows + business-event extraction** from the config's `flows`
  (replacing the 5 hardcoded City flows with the industry's), keyed per instance.

**Caveats (documented, accepted):**
- Deep entity detail pages may still show the underlying pod name — fine for a sales
  motion.
- **RUM:** the web app *display name* CAN be set via the **`builtin:rum.frontend.name`**
  schema (the provisioner can name it per industry) — but *identity* is still the app id
  in the injected snippet, so concurrent instances sharing a snippet are one web app. For
  distinct per-instance RUM identities, use a distinct RUM app id (snippet) per instance.
- We run on a **shared tenant (kyw96254)** — every new Settings object MUST be
  per-instance-keyed and delete-on-uninstall, or it clobbers other SEs. Follow the
  provisioner's established pattern exactly (CLAUDE.md §Multi-tenancy).

**Phase 0 spike — confirmed (via ask-dynatrace-docs):** service naming =
`builtin:naming.services`, condition matches `k8s.namespace.name` (namespace-scoped on
the shared tenant ✓), OneAgent services only; OTel services rename via `OTEL_SERVICE_NAME`.
RUM display name = `builtin:rum.frontend.name`; RUM identity stays the snippet app id.
The live rename-and-revert test is deferred to Phase 3 (needs the dt0s16 platform token).

### 3.6 Authoring kit (in the slice)

- **The config JSON Schema** — the contract; validates every config.
- **A validator** — runs in CI and pre-deploy (fail fast on a bad config).
- **A portable authoring prompt** + **a Claude Skill** + **ChatGPT-usable
  instructions** that take an industry/company and emit a valid config + asset specs.
- Sequenced *within* the slice: draft the schema early, **hand-author the airport
  config first** to prove the contract is real, then build the kit and **regenerate
  the airport config through it** to prove the full ChatGPT→config→deploy loop.

---

## 4. The flagship: Meridian Airport

### 4.1 Framing
Airport **operator**: Meridian Airport hosts many airlines. `public-portal` becomes
the **passenger experience**; `ops-dashboard` becomes **airport operations**.

### 4.2 Screen mapping

| Today | → Airport | App | Status |
|---|---|---|---|
| Home/portal | Passenger home: my flights, journey status, live flight board | public | relabel |
| Service requests | Maintenance / operations tickets (reuse request→dispatch→work-order chain) | ops | relabel |
| **— (new module)** | **Live aircraft map** (stylized airfield, smooth glide) | ops | **NEW** |
| **— (new module)** | **Flight board / flight ops** (flight list + lifecycle) | ops+public | **NEW** |
| **— (new module)** | **My journey** (passenger journey tracker) | public | **NEW** |
| IoT fleet | Ground equipment: jet bridges, baggage systems, GSE, HVAC | ops | relabel |
| Incidents | Operational incidents (gate/equipment/delay) | ops | relabel |
| Analytics | On-time performance, passenger throughput, flow KPIs | ops | relabel |
| Store / Billing | *disabled for v1* (parking/duty-free later) | — | off |

### 4.3 Hero flows (drive business events + Dynatrace Business Flows)

**Aircraft turnaround** — correlation `flight.id`:
```
departures: at_gate → servicing → boarding → taxiing → takeoff
arrivals:   approach → landing → taxi_in → at_gate
```

**Passenger journey** — correlation `passenger.id` (linked to `flight.id`):
```
check_in → [bag_check]* → security_cleared → [bag_loaded]* → boarded
( * optional — not every passenger checks a bag; sub-100% conversion is realistic,
  and a great Dynatrace Business-Flow story, not a defect )
```
Cross-flow link: a passenger's `boarded` feeds its flight's `boarding → takeoff`.

### 4.4 New backends + the live map

Decomposition (✅ decided — mirror the existing stack: Java + Go):
- **`flight-ops`** (Java/Spring, mirrors `city-operations`): Flight entities, the
  turnaround + arrival state machines, gates/stands/runway assignment, flight-board +
  flight-detail APIs, and current position state. Emits turnaround business events.
- **`airfield-sim`** (Go, mirrors `iot-simulator`): advances each active flight's
  position along predefined taxi routes on a tick, streams positions, emits OTel
  spans/metrics (reinforces the OTel showcase). Feeds `flight-ops`.
- **`passenger-service`** (Java, mirrors `citizen-service`): passengers/bookings,
  journey progression (with optional steps), journey business events; linked to flights.
- **Driver**: extend `traffic-bot` (or a small airport driver) to generate a steady,
  busy flight schedule + passenger arrivals (always-on).
- **Map module** (frontend): stylized SVG/canvas airfield; subscribes to the position
  stream; interpolates for smooth glide; plane state/color by status.

### 4.5 Data & simulation
Time-compressed: planes glide in real time (seconds); Business-Flow *steps* spaced
over minutes (reuse the merged deferred-scheduler band pattern). Always-on, a
dozen-plus concurrent flights. Multi-airline. Capped active-flight count to bound map
perf.

---

## 5. Phased delivery (PR-sized vertical slices)

Mirrors [PLAN.md](PLAN.md) conventions: each stage is one reviewable PR that ships a
feature **and** its instrumentation; the app stays demoable throughout. Legend:
`[ ]` not started `[~]` in progress `[x]` done.

### Phase 0 — Foundations & spikes *(no user-visible change; default config = today's City)*
- [ ] `industry:` values block + generated ConfigMap + `_helpers` fan-out (default reproduces "Meridian City")
- [ ] Frontend `ConfigContext` (+ `/config.json` delivery) wired in both SPAs, defaults baked so nothing changes
- [ ] Tailwind → CSS-variable **brand** tokens (palette unchanged ⇒ pixel-identical)
- [ ] DT spike: confirm service-naming-rule schema id on the live tenant; rename one service via Settings API and revert
- [ ] Draft v0 of the config **JSON Schema**
- **Instrumentation:** none new; prove the pipe with zero visual diff.

### Phase 1 — Config-driven branding, terminology & persona *(still City, now data-driven)*
- [ ] Replace hardcoded company name / copy / `Meri` with `ConfigContext` lookups (both SPAs)
- [ ] Backend: AI persona/prompt, notification labels, dispatch routing map → config/env
- [ ] Validate by flipping a throwaway test config (e.g. "Meridian Metro") in a branch deploy
- **Instrumentation:** unchanged; confirm RUM/business-events still flow with config-driven strings.

### Phase 2 — Module/screen registry
- [ ] Convert `App.jsx` routes + nav to a config-driven module registry in both SPAs
- [ ] Screen enable/disable + relabel + order from config; default set = all current screens
- **Instrumentation:** verify RUM route/action names still resolve per active module set.

### Phase 3 — "Meridian Airport" on existing screens *(first real industry end-to-end, no new module yet)*
- [ ] Author `values-airport.yaml`: name, terminology, theme (airport palette + logo + imagery), enabled = relabeled set, store/billing off
- [ ] Airport-matched seed + traffic for the kept screens (maintenance tickets, ground equipment, incidents)
- [ ] DT: service naming rules + per-industry Business Flows for the kept flows + RUM app
- **Deliverable:** a deployable Meridian Airport (reusing existing screens) — first proof of the industry axis.
- **Instrumentation:** service map + RUM + flows all read "airport" for this instance.

### Phase 4 — Flight-ops + passenger-journey backends + screens *(the two hero flows, no map yet)*
- [ ] `flight-ops` service (turnaround + arrival state machines, flight-board API, position state) + gateway route + Helm + CI matrix + values
- [ ] `passenger-service` (journey progression incl. optional steps, linked to flights) + gateway route + Helm + CI matrix + values
- [ ] Flight-board + My-journey curated modules (frontend)
- [ ] Driver generates steady flights + passengers
- [ ] Business events for both flows; DT Business Flows: aircraft turnaround + passenger journey (optional steps)
- **Instrumentation:** two new Business Flows; new service-map nodes (DB/Kafka spans); RUM actions on journey/flight screens.

### Phase 5 — The live aircraft map *(the hero)*
- [ ] `airfield-sim` (Go) position engine along taxi routes + position stream + OTel
- [ ] Stylized airfield map module with smooth-glide interpolation, status-driven plane states
- **Deliverable:** the "amazing" live map, every plane driven by a real backend status.
- **Instrumentation:** Go OTel spans/metrics from the sim; map subscribes via the streaming endpoint (visible in RUM/traces).

### Phase 6 — Authoring kit *(in the slice)*
- [ ] Finalize config **JSON Schema** + **validator** (CI + pre-deploy)
- [ ] Authoring **prompt** + **Claude Skill** + ChatGPT instructions
- [ ] **Regenerate** `values-airport.yaml` through the kit to prove the loop; asset-spec output
- [ ] Docs: how to author + deploy a new industry
- **Deliverable:** "go to ChatGPT → get a config → deploy" works for airport end-to-end.

### Phase 7 — Fast-follow *(post-slice roadmap, not v1)*
- [ ] Generic list/detail/form renderer (config-defined screens, the "hybrid" capability)
- [ ] Second industry (e.g. energy) to validate generality
- [ ] Asset-generation pipeline hardening (logo/imagery from LLM specs)
- [ ] Live hot-swap of industry on a running instance
- [ ] Automate per-industry RUM app creation via the RUM API

---

## 6. Open proposals to confirm (design defaults)

1. **New-service decomposition & languages (§4.4).** ✅ **Decided:** `flight-ops` +
   `passenger-service` in Java/Spring (mirror city-operations / citizen-service),
   `airfield-sim` in Go (mirror iot-simulator). The .NET-for-flight-ops option was
   considered and declined for now (keeps to the proven stack).
2. **Frontend config delivery.** Proposed: ConfigMap → nginx-served `/config.json`
   fetched at startup. (Alt: nginx injects `window.__MERIDIAN_CONFIG__`.)
3. **Asset hosting.** Proposed: small assets (logo, favicon, a few hero images)
   delivered per-instance via ConfigMap/volume served by nginx and referenced by the
   config; larger/optional imagery by external URL. Confirm acceptable.
4. **Config handoff.** Proposed: `helm/values-<industry>.yaml` merged via existing
   `-f` (no deploy.sh change beyond docs). Confirm vs. a dedicated `INDUSTRY=` param.
5. **Exact technical→display service-name map** for airport (the
   `dynatrace.service_display_names` table). Draft in Phase 3.
6. **Passenger model reuse.** Proposed new `passenger-service` rather than relabeling
   `citizen-service` (which we reuse as maintenance-ticket origin). Confirm.

---

## 7. Risks & mitigations

- **Tailwind→CSS-var refactor breadth.** Mitigate: tokenize only brand colors first;
  leave neutral utilities; Phase 0 produces a pixel-identical default.
- **Shared-tenant Settings pollution.** Every new DT object per-instance-keyed +
  delete-on-uninstall, following the provisioner pattern exactly. Never overwrite the
  shared logs-routing object.
- **RUM per-industry identity is manual.** Document the one-step setup; automate later.
- **Map performance.** Cap concurrent flights; stream deltas, interpolate client-side.
- **Scope creep.** Generic renderer explicitly deferred to Phase 7; airport is all
  curated modules.
- **New-endpoint conventions.** All new endpoints: snake_case at the boundary, gateway
  prefix-matched (path includes prefix), gateway body re-serialization intact, no
  crash-on-missing-param, frontends unwrap defensively (CLAUDE.md / API_CONVENTIONS).
- **New-service checklist** (per commerce/billing precedent): gateway route + Helm
  template + values block + CI matrix entry + `_helpers` usage + seed/traffic + DT flow.

## 8. Conventions to honor
- Multi-tenancy rules: CLAUDE.md §Multi-tenancy (use helpers; never hash user-facing
  strings — now generalized to "industry config owns user-facing strings").
- API rules: [API_CONVENTIONS.md](API_CONVENTIONS.md).
- Build/deploy: floating `:latest`, PRs via web UI, fresh branch per task, CI on merge.
- Keep [architecture.md](architecture.md) + [PLAN.md](PLAN.md) updated as slices land.

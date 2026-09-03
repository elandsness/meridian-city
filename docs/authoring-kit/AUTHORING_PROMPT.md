# Meridian Platform — Industry Demo Authoring Prompt

> **How to use this file:** copy *everything below the line* into any capable LLM
> (ChatGPT, Claude, Gemini…). Tell it which industry you want. It will research
> the domain, design entity types, and output a complete `values-<industry>.yaml`.
> Save that file under `helm/` and deploy.
>
> **Extensibility note (for Meridian developers):** Adding a new home module or screen
> template only requires (a) creating the component, (b) registering it in the relevant
> `homeModules.jsx` or `screens.jsx`, (c) adding its template id to the schema enum,
> and (d) documenting it in this catalog. The LLM will pick it up automatically on
> next use — no changes to this prompt structure needed.

---

You are helping a Dynatrace Sales Engineer re-skin **Meridian**, a microservices
observability demo platform, for a specific industry. Meridian has two React apps
(a customer **portal** and an **ops dashboard**), a generic entity/lifecycle engine
on the backend, and Dynatrace business-flow instrumentation — all driven by one
declarative YAML config. Your job is to research the industry and produce a complete,
deployment-ready config.

**Core principle:** You are *composing* configuration, not writing code. Meridian
provides a fixed catalog of screens and home modules. For any new domain object
(a claim, a container shipment, a meter reading), you *design* it as an entity type
inside the config's `entities:` block — no new code required.

---

## Step 1 — Ask the SE (skip anything already provided)
1. **Industry / domain** (e.g. hospital network, shipping port, electric utility, retail bank).
2. **Company / brand name** and a **short name**.
3. **Brand colors** (hex) or a reference (logo, website) — infer tasteful professional ones if not given.
4. Anything they specifically want to **showcase** (a particular flow, entity type, Dynatrace feature).

---

## Step 2 — Research the industry before designing anything

**If you have internet access, use it now.** Search for:
- How this industry operates day-to-day and what its key performance metrics are.
- What end users (customers / patients / passengers / members) typically need to do.
- What operational roles and departments exist.
- What physical assets, sensors, or equipment the industry monitors.
- Industry-specific terminology (what they call a "service request", "incident", "work order").
- 2-3 industry-specific workflow examples that would make a compelling Dynatrace demo.

The more you understand the real industry, the more authentic the demo will be.
Research first, design second.

---

## Step 3 — Design your entity types

This is the creative core of the config. Meridian's generic entity engine lets you
define *any* domain object — a flight, a shipment, a prescription, a meter reading,
a loan application — as a config-driven entity with typed fields, lifecycle states,
and transitions. You don't write code; you write config.

**When to define a custom entity type:**
- The industry has a domain-specific object that isn't well represented by a generic
  "service request" or "incident" (e.g. a container at a port, a patient admission at
  a hospital, a meter reading at a utility).
- The object has a multi-step lifecycle that's worth visualising (checking in → processing
  → approved → disbursed → closed, for example).
- A journey/tracker view would make a compelling customer-facing demo.

**When NOT to define a custom entity type:**
- You're just renaming "service request" to "trouble ticket" — use `terminology` instead.
- The workflow is identical to an existing entity with different labels.

### Entity type DSL

```yaml
entities:
  <entity_type_key>:               # snake_case, no hyphens (e.g. claim, container, prescription)
    displayName: "<Singular name>"
    displayNamePlural: "<Plural>"
    idPrefix: "<short prefix>"     # 2-6 lowercase letters, NO hyphens (e.g. clm, ctr, rx)
    fields:
      <field_name>:                # snake_case, no hyphens (e.g. claim_number, status)
        type: string|number|boolean|date|enum|ref
        required: true|false
        default: <value>           # optional
        values: [...]              # enum type only
        entity: <other_type_key>   # ref type only: links to another entity
    initial: <state_key>           # must be a key in states
    states:
      <state_key>:                 # snake_case, no hyphens
        label: "<Human-readable label>"
        tone: slate|blue|amber|orange|green|red
        terminal: true             # set on states that are final (no further transitions)
        isError: true              # set on error/failure terminal states
        isKpi: true                # set on states worth counting as a business KPI
        glyph: "<emoji>"           # shown as a sprite on the entity-map
    transitions:
      - from: <state_key>
        to: <state_key>
        timer:
          minSeconds: 30
          maxSeconds: 120
        when:                      # optional condition (first match wins)
          probability: 0.15        # random chance this transition fires
          # OR: { field: amount, equals: 0 }
          # OR: { faultGate: true, probability: 0.08 }
          # ⚠️ ONLY these three forms of 'when' are valid. Do NOT invent others —
          # e.g. stateTransitionEvent, fieldEvent, ruleEngine, externalTrigger, etc.
          # are not platform features and will be silently ignored or crash the engine.
    computed:
      position:
        type: point2d
        interpolation: linear|easeInOut
        waypoints:                 # state → position on the entity-map SVG
          <state_key>: { x: 120, "y": 468 }   # ALWAYS quote "y" — see gotchas
    generator:
      strategy: simpleSteadyState
      intervalMs: 20000            # how often to create a new entity
      maxActive: 12                # target number of active entities
    linkOnCreate:                  # optional: link to another entity at creation time
      <field_name>:
        query: { state: { notIn: [terminal_state] } }
        strategy: random
        required: false
```

**Gotchas — read before writing any entity config:**

1. **Always quote `"y"` in waypoint YAML.** YAML 1.1 treats the bare key `y:` as
   boolean `true` (the "Norway problem" — same as `Yes`, `No`, `On`, `Off`). This
   silently corrupts the position data and crashes the movement service. Always write
   `"y": 280` not `y: 280`.

2. **`idPrefix` must be `[a-z][a-z0-9]*` — no hyphens.** `flt` is valid; `flt-d` is
   not. Use a short run of lowercase letters (2-6 chars).

3. **Field names are `snake_case` wire keys** — they must match the JSON the API
   returns. Never camelCase them in the config.

4. **State keys are `snake_case`, no hyphens.** `at_gate` is valid; `at-gate` is not.

5. **Every transition `from`/`to` must be a key in `states`.** The validator checks
   reachability from `initial` — an unreachable state (one no transition leads to)
   is a validation error unless it has `externallyTriggered: true`.

6. **Tones are limited to:** `slate`, `blue`, `amber`, `orange`, `green`, `red`.
   No `cyan`, `purple`, etc.

7. **`entity-journey` screen `steps` list must use state keys (snake_case), not labels.**

8. **`when: { probability }` alone does NOT make a transition fire automatically.**
   `when` is a filter that selects *which* branch to take when the timer fires — it
   is not a trigger by itself. A transition with no `timer` block will never be
   scheduled by the engine, so entities in that state will never advance. Every
   auto-advancing transition must have a `timer`:
   ```yaml
   # WRONG — probability only, entity stays stuck forever
   - from: normal
     to: degraded
     when: { probability: 0.04 }

   # CORRECT — timer fires periodically; probability determines which branch wins
   - from: normal
     to: degraded
     when: { probability: 0.04 }
     timer: { minSeconds: 3600, maxSeconds: 14400 }
   - from: normal
     to: normal   # no-op loop back, the other 96% of the time
     timer: { minSeconds: 3600, maxSeconds: 14400 }
   ```
   A cleaner pattern for infrequent failures: put the fault on a separate timed
   transition that only fires sometimes, and let the happy path be the default.

9. **`work_order` is a reserved entity name — do not redefine it.** The platform's
   built-in `work_order` has cascade effects that auto-resolve linked incidents when
   the work order closes. If you define your own `work_order` entity you replace those
   effects, breaking the IoT incident → work order → incident resolved chain and
   causing permanent "degraded" dots on every device map. If you need a domain-specific
   field-work entity (crew dispatch, maintenance job, field ticket), use a different
   name: `field_order`, `crew_job`, `repair_ticket`, etc.

10. **Every entity type with a generator must appear in at least one screen or home
    module.** If you define an entity and give it a `generator` but don't surface it
    anywhere in `screens` or `home`, the engine creates entities that are invisible to
    users. Either add a screen (`entity-list`, `entity-map`, or `entity-journey`) or
    remove the generator.

---

## Step 3b — Fleet / moving-map entities: the `journey` type

If the industry has a **fleet of things gliding between named locations on a map**
(trucks between hubs, delivery vans between depots, ships between ports, ride-share
cars between zones) — do **not** model it as a regular custom entity with
`computed.position.waypoints`. That mechanism ties position to *states* (like a
flight moving through gate → taxi → takeoff) and requires one waypoint per state.
A fleet vehicle instead moves continuously along an **origin → destination line**,
which is a different, purpose-built backend: **journey-service**.

**How it works:** `journey` is a reserved, built-in entity type name — the API
gateway routes `/api/v1/entities/journey` straight to journey-service (a dedicated
microservice, not the generic entity engine), which linearly interpolates each
journey's position between an origin point and a destination point as it advances.
This means:

- The `entityType` you put in any `entity-map`/`entity-list` screen or home module
  must be **exactly `journey`** — not `truck`, not whatever your fleet unit is
  called. `journey` is the routing key the gateway recognizes; anything else 404s.
- You still declare an `entities.journey` block for frontend rendering only
  (glyph/tone/label per status, used for the legend and sprite color) — but its
  `states`, unlike every other entity type, do **not** drive the backend state
  machine. journey-service's status progression is **global across the whole
  platform and fixed**, not configurable per industry: `initiated → in_progress →
  completed`. You cannot invent new status names (`loading`, `customs`,
  `delivered`) — the backend will simply never enter them, so a state you declare
  outside that fixed set will never appear on the map. Use `initialStatuses` (below)
  to skip straight to `in_progress` if you don't need an `initiated` stage.
- Do **not** add `computed.position` / `waypoints` to `entities.journey` — it is
  ignored. Position comes from journey-service's own origin/destination
  interpolation (see below), computed server-side from real route coordinates, not
  from the generic waypoints mechanism.
- Because `journey` is served by its own microservice, it is **not** part of the
  generic entity engine — do **not** add `journey` to `customerEntityService` or
  `opsEntityService` `ownedTypes` (Rule P1 does not apply to it).

**The `journeyService` Helm block — REQUIRED, and it lives OUTSIDE `industry:`**
(top-level in `values-<industry>.yaml`, a sibling of the `industry:` key, exactly
like `customerEntityService`/`opsEntityService` overrides):

```yaml
# Outside industry: — configures the actual backend simulation, not just labels.
journeyService:
  lifecycle:
    minSeconds: 20      # override the default 300–7200s (5min–2hr) band so
    maxSeconds: 60      # movement is visible within a normal demo session
  generator:
    maxActive: 10                     # target number of active journeys
    entityTypes: ["truck"]            # internal display label(s) for generated
                                       # records — cosmetic only, NOT the routing
                                       # key (that's always "journey", see above).
                                       # Replaces the default ["flight","passenger"]
                                       # entirely, so flights/passengers stop
                                       # generating once you set this.
    initialStatuses:
      truck: "in_progress"            # skip "initiated" — start moving immediately
    routes:                           # named origin/destination pairs + map
                                       # coordinates (same abstract x/y space as
                                       # the entity-map's viewBox, not lat/lng).
                                       # A new journey picks one at random and
                                       # glides from (originX,originY) to
                                       # (destX,destY) as progress advances.
      - { origin: "Seattle DC", destination: "Tacoma Hub",
          originX: 180, originY: 200, destX: 210, destY: 290 }
      - { origin: "Seattle DC", destination: "Spokane Terminal",
          originX: 180, originY: 200, destX: 830, destY: 180 }
```

**Do not invent a `journeyService.lifecycle.transitions` key** — the status
progression (`initiated`/`in_progress`/`completed`) and its progress-per-status
mapping are fixed in journey-service's own defaults and are not exposed as a Helm
value. Only `lifecycle.minSeconds`/`maxSeconds` (timing) and
`generator.{maxActive,entityTypes,initialStatuses,routes}` are configurable.

**Drawing the routes themselves is a separate, manual step.** journey-service gives
you moving sprites between two points — it does not draw a line between them. If
you want the routes visible on the map (recommended for a fleet network), add
matching `line` shapes to the screen's `background.shapes` (see 4a below) using the
same coordinates as each route's `originX/Y`/`destX/Y`.

---

## Step 4 — Compose the config using the catalog

### 4a. Screens

Each screen entry is either `"<id>"` or `{ id: <id>, label: "Nav label", icon: "🔔" }`.

**Portal (`screens.public`):**
| id | What it is | When to use |
|----|-----------|-------------|
| `home` | Landing page (modules from `home.public`) | always |
| `service-requests` | Submit + track requests/issues | generic — relabel via terminology |
| `store` | Online store + orders | if the industry sells goods |
| `billing` | Pay bills / fees | if the industry bills customers |
| `messages` | Notifications inbox + AI assistant | generic — always useful |
| `my-journey` | Passenger journey tracker (aviation-specific) | aviation / transport only |
| `{ template: 'entity-list', entityType: '<type>' }` | Generic entity list for any type | any custom entity |
| `{ template: 'entity-detail', entityType: '<type>' }` | Generic entity detail + timeline | any custom entity |
| `{ template: 'entity-map', entityType: '<type>' }` | Moving-sprite map for any type | entities with `computed.position` |
| `{ template: 'entity-analytics', entityType: '<type>' }` | KPI + chart for any type | any custom entity |
| `{ template: 'status-map', source: 'devices', background: {...}, ... }` | Geographic/infrastructure status map with live colored dots | "Show me what's happening in my area" — outage maps, ATM finders, parking lots, grid status |

> ❌ **`entity-journey` with `ownerField` is NOT in this table.** It is not a valid option for the
> public portal with custom entity types. The only personal journey tracker in the public portal
> is the built-in `my-journey` (aviation only, listed separately above). For all other industries,
> use `entity-list` to show the live pipeline of entities. See the full constraint explanation below.

**`status-map` config shape — `background` is REQUIRED:**
```yaml
- id: atm-network-map          # unique id, lowercase-hyphen
  template: status-map
  label: "Find ATM & Branch"   # nav label shown to users
  icon: "🏧"
  title: "ATM & Branch Network"  # card heading inside the page
  source: devices              # 'devices' = IoT device fleet (status from IoT API)
  viewBox: "0 0 1000 580"      # SVG coordinate space; match the background image proportions
  background:                  # REQUIRED — omitting this renders a blank map with no context
    kind: image                # 'image' renders a full-canvas background image
    src: /bank_atm_bg.png      # local static file committed to frontends/public-portal/public/
    # — OR — supply an HTTPS Unsplash URL; the deploy script fetches and stores it locally:
    # src: "https://images.unsplash.com/photo-1524661135-423995f22d0b?w=1600&q=80"
```

A `status-map` without a `background` is a blank canvas — dots float on white with no
geographic or spatial context. Always supply a background image. Unsplash works well;
use a photo that makes spatial sense for the domain (aerial city, power grid, port, campus).

**`entity-map` background — `image` OR `shapes`:**

`entity-map` (screens and home modules, used for `journey`/fleet maps and any other
entity type with a computed position) supports two background kinds:

- `kind: image` — same as `status-map` above: `{ kind: image, src: <path-or-URL> }`.
  Use for a photographic or realistic map background.
- `kind: shapes` — a schematic vector diagram drawn directly in the config, no image
  asset needed. `shapes` is a list of primitives, each rendered as a raw SVG element
  — every property you write is passed straight through as an SVG attribute, so any
  valid SVG attribute name works, not just the ones shown below:

  | `type` | Renders as | Common properties |
  |--------|-----------|-------------------|
  | `rect` | `<rect>` | `x`, `"y"`, `width`, `height`, `fill`, `stroke`, `"stroke-width"`, `rx` |
  | `circle` | `<circle>` | `cx`, `cy`, `r`, `fill`, `stroke`, `"stroke-width"` |
  | `line` | `<line>` | `x1`, `"y1"`, `x2`, `"y2"`, `stroke`, `"stroke-width"`, `stroke-dasharray` |
  | `text` | `<text>` | `x`, `"y"`, `text` (the string shown), `fill`, `"font-size"`, `"font-weight"`, `"text-anchor"` |

  ```yaml
  background:
    kind: shapes
    shapes:
      - { type: rect, x: 40, "y": 30, width: 920, height: 540, fill: "#0f172a", stroke: "#334155", "stroke-width": 2, rx: 12 }
      - { type: circle, cx: 180, cy: 200, r: 8, fill: "#fbbf24" }
      - { type: text, x: 180, "y": 185, text: "Seattle DC", fill: "#e2e8f0", "font-size": 13, "text-anchor": middle }
      - { type: line, x1: 180, "y1": 200, x2: 210, "y2": 290, stroke: "#475569", "stroke-width": 2, "stroke-dasharray": "4 3" }
  ```

  Only `rect`, `circle`, `line`, and `text` are supported — no `path`/`polygon`.
  Approximate curved boundaries or complex outlines with several short `line`
  segments, or fall back to `kind: image` with a real map graphic.

  ⚠️ **Only `x`/`y`-style bareword keys need quoting**, per the waypoints gotcha
  above (`"y"`, `"y1"`, `"y2"` — YAML 1.1's Norway problem). Hyphenated keys like
  `stroke-width`, `font-size`, `text-anchor` are never coerced and don't need
  quoting, but quoting them is harmless if you prefer consistency.

  **The `legend` shown under an entity-map is auto-generated** from the entity
  type's `states` (`glyph`/`tone`/`label`) — there is no `legend:` key to author by
  hand in the config; any such key is ignored.

The map overlays colored dots (green = ok, amber = degraded, red = out of service) on the
background image — one dot per device, scattered deterministically by device_id. Dots update
every 15 s from the live device fleet. No explicit dot positions are needed; they are
auto-scattered across the canvas. For a `background.src` HTTPS URL, the deploy script
downloads the image at `helm install`/`upgrade` time and rewrites the ConfigMap to reference
a local `/industry-assets/` path, so the browser always loads from the same origin.

**Ops dashboard (`screens.ops`):**
| id | What it is | When to use |
|----|-----------|-------------|
| `overview` | Ops landing (modules from `home.ops`) | always |
| `requests` | Request / work queue | generic — relabel |
| `incidents` | Operational incidents | generic — relabel |
| `iot` | Connected-device / asset fleet | if the industry has sensors/equipment |
| `analytics` | Business analytics / KPIs | generic |
| `demo-control` | Demo control panel | **always keep** |
| `flight-board` | Live flight board | aviation only |
| `airfield` | Live airfield map | aviation only |
| `{ template: 'entity-list', entityType: '<type>' }` | Generic entity list | any custom entity |
| `{ template: 'entity-map', entityType: '<type>' }` | Moving-sprite map | entities with computed position |
| `{ template: 'entity-analytics', entityType: '<type>' }` | KPI + chart | any custom entity |
| `{ template: 'entity-journey', entityType: '<type>', steps: [...] }` | Journey board | any step-based entity |

**Choosing the right public portal screen for infrastructure/area views:**

| User intent | Right template | Wrong template |
|-------------|---------------|----------------|
| "See where outages are happening near me" | `status-map` | `entity-journey` |
| "Check the status of grid/ATM/parking infrastructure" | `status-map` | `entity-journey` |
| "Track *my* loan / claim / order" | `entity-list` (no ownerField) | `entity-journey` with ownerField |
| "See live activity for admissions / flights / repairs" | `entity-list` (no ownerField) | `entity-journey` with ownerField |

**`ownerField` does not work for any custom entity type. Do not use it.**

`ownerField` is not a supported feature for custom entity types. Do not include it in any public portal screen. Writing a comment like "user submits form → sets account_id" does not make it work — the platform code determines entity creation, not YAML comments. There is no form, API, or flow in this platform that creates a custom entity instance on behalf of a logged-in user. Whether the entity has a generator or not makes no difference: the result is always an empty journey for every user.

**The only valid personal tracker in the public portal is `my-journey` (aviation built-in, not configurable).**

For all other industries, use `entity-list` (no `ownerField`) — shows the live entity pipeline as a real-time feed, which is compelling and actually works.

**`entity-journey` for the ops dashboard (no `ownerField`) — valid and useful:**
```yaml
# Ops dashboard: show all entities of this type in their current state (no ownerField)
- id: claims-board
  template: entity-journey
  entityType: claim
  label: "Claims Pipeline"
  steps: [submitted, under_review, approved, paid]
  # No ownerField — shows ALL entities, appropriate for ops staff
```

### 4b. Home modules

Entries in `home.public` / `home.ops` are either a **string id** (static module) or
a **template object** (dynamic module with config props).

**Portal (`home.public`) — static module ids:**
| id | What it is | When to use |
|----|-----------|-------------|
| `welcome-hero` | Brand hero banner (auto-reads company.name + tagline) | great opener |
| `announcements` | Scrollable bulletin board | if you configure items |
| `quick-actions` | Quick-action tiles (auto-gated by active screens) | generic |
| `city-home` | Default city home bundle | bare minimum if nothing else |
| `chat-teaser` | AI assistant preview card | when messages screen is active |
| `flight-status` | Departures/arrivals board | aviation only |
| `airfield-map` | Airfield map card | aviation only |
| `my-journey` | Journey tracker call-to-action | aviation only |

⚠️ **`weather-widget`, `clock-widget`, `entity-map`, etc. are template modules — not static ids.** They must use
the `{ id: <unique>, template: weather-widget, ...props }` object form, not a bare string. Writing
`- weather-widget` as a string will render blank or crash because there is no built-in screen with that id.

**Portal — template modules (use `{ id, template, ...props }`):**
| template | What it is | Props |
|---------|-----------|-------|
| `ticker` | Scrolling content bar — any strings | `height: slim\|half\|full`, `items: [...]`, `label?`, `title?`, `preset?: stocks\|sports` |
| `weather-widget` | Weather card | `mode: perfect\|forecast` |
| `clock-widget` | Live clock(s) | `timezones?: [{tz, label}]` |
| `announcements` | Bulletin board | `items: [{title, body, tone?}]`, `title?` |
| `entity-map` | Entity moving-map card | `entityType`, `viewBox`, `background`, `legend?` |
| `entity-summary-card` | KPI strip for an entity type | `entityType`, `label?` |

**`ticker` is a single generic component — the content is what you configure.**
Write `items` as whatever strings make sense for the industry from your research:
- Departure board: `"MC501  New York JFK  14:30  ON TIME"`, `"MC302  Chicago ORD  15:00  BOARDING"`
- Commodity prices: `"Gold  $2,341  ▲0.4%"`, `"WTI Crude  $78.20  ▼1.1%"`, `"Natural Gas  $2.88  ▲2.3%"`
- Ops metrics: `"ICU capacity 87%"`, `"OR utilization 92%"`, `"ED wait: 42 min"`
- News: `"New sustainability initiative announced"`, `"Q3 earnings beat estimates by 8%"`

If the LLM does not provide `items`, the component falls back to `preset: stocks` or `preset: sports`
for plausible placeholder content — but industry-specific items are always better.

Example ticker configuration:
```yaml
home:
  public:
    - welcome-hero
    - id: departures
      template: ticker
      height: slim
      label: "✈️ DEPARTURES"
      items:
        - "MC501  New York JFK  14:30  ON TIME"
        - "MC302  Chicago ORD  15:00  BOARDING"
        - "MC817  Los Angeles LAX  16:45  ON TIME"
        - "MC204  Miami MIA  17:00  DELAYED 20 min"
    - { id: weather, template: weather-widget, mode: forecast }
    - quick-actions
```

**Ops (`home.ops`) — static module ids:**
| id | What it is | When to use |
|----|-----------|-------------|
| `ops-overview` | KPI row + requests-over-time chart | generic baseline |
| `flight-summary` | Live flight KPI strip | **aviation only** — do NOT include for non-aviation industries |

**Ops — template modules:**
| template | What it is | Props |
|---------|-----------|-------|
| `ticker` | Scrolling content bar — any strings | `height: slim\|half\|full`, `items: [...]`, `label?`, `title?` |
| `weather-widget` | Weather card | `mode: perfect\|forecast` |
| `clock-widget` | Live clock(s) | `timezones?: [{tz, label}]` |
| `announcements` | Bulletin board | `items: [{title, body, tone?}]` |
| `entity-map` | Entity moving-map card | `entityType`, `viewBox`, `background`, `legend?` |
| `entity-summary-card` | KPI strip for one entity type | `entityType`, `label?` |
| `entity-kpi-row` | KPI row across multiple entity types | `entityTypes: [...]`, `label?` |
| `activity-feed` | Live entity state-transition feed | `entityTypes?: [...]`, `maxItems?: 10` |

**Ticker height guide:**
- `slim` (default): A single-line horizontal scrolling marquee bar. Best as a top-of-page strip.
- `half`: A compact card ~160px tall. Shows a rotating list with highlight effect.
- `full`: An expanded card ~300px tall showing all items.

**Minimum home module requirements:**
- Portal: at least 2 modules in `home.public` (the `home` screen is always blank without them).
- Ops: at least 1 module in `home.ops`.

### 4c. Terminology

Rename generic nouns to industry-specific ones. The fields below are **always optional**:
`customer`, `customerPlural`, `request`, `requestPlural`, `incident`, `incidentPlural`,
`workOrder`, `asset`, `assetPlural`.

The following fields look optional but are **effectively required** when the named screen
is active — omitting them causes the UI to fall back to city-specific defaults that will
look broken for any non-city industry.

**`requestCategories` — REQUIRED for any non-city industry.** These are the dropdown
options on the "Submit a request" form AND they must exactly match the keys in `routing`.
If the two lists diverge, form submissions with unrouted categories will produce a 500
error. Rules:
- Every key in `routing` must appear in `requestCategories`.
- Each entry is a short lowercase slug (hyphens OK for multi-word: `card-dispute`).
- Always end with `other`.
- The default when omitted is the city list (`infrastructure`, `utilities`, `safety`,
  `environment`, `transport`, `other`) — meaningless for non-city contexts.

**⚠️ `routing` is a TOP-LEVEL key — same indentation as `terminology`, `entities`, `data`, `dynatrace`.
Never nest `routing` inside `terminology`. They are siblings, not parent/child.**

```yaml
# Good: terminology and routing at the same level (both top-level)
terminology:                          # ← top-level
  requestCategories: [account-issue, card-dispute, loan-inquiry, fraud-report, password-reset, other]

routing:                              # ← top-level (NOT indented under terminology)
  account-issue: "Retail Banking"
  card-dispute: "Card Operations"
  loan-inquiry: "Lending"
  fraud-report: "Fraud Detection"
  password-reset: "Digital Support"
  other: "General Support"           # always include 'other' — it's in every requestCategories list

# ❌ WRONG — routing is nested inside terminology (silently ignored)
terminology:
  requestCategories: [account-issue, ...]
  routing:                            # ← THIS IS WRONG
    account-issue: "Retail Banking"
```

**`billingTitle`, `billingSubtitle`, `billNoun` — REQUIRED if `billing` is in `screens.public`.**
Without them the billing page shows the hardcoded city fallbacks ("Tax & billing", "tax bill").
- `billingTitle` — page heading / nav label (e.g. `"Pay My Bill"`, `"Billing & Payments"`)
- `billingSubtitle` — subtitle beneath the heading (e.g. `"Your PowerUnlimited electricity bills and payment history."`)
- `billNoun` — singular noun for one bill shown inline (e.g. `"electric bill"`, `"credit card statement"`, `"invoice"`)

```yaml
terminology:
  billingTitle: "Billing & Payments"
  billingSubtitle: "Your PowerUnlimited electricity bills and payment history."
  billNoun: "electric bill"
```

### 4d. Theme
`theme.colors`: `brand`, `brandDeep`, `brandSoft`, `brandTint`, `accent`, `accentSoft`,
`accentInk` — all hex (`#RGB` or `#RRGGBB`). All color tokens should form a coherent
palette: `brandDeep` darker than `brand`, `brandSoft` lighter, `brandTint` very light.

**Image fields** (`theme.heroImage`, `theme.favicon`, `theme.logo`):

Supply either a local path (file committed to `frontends/public-portal/public/`) or a
fully-qualified HTTPS URL. When a URL is given, `deploy.sh install`/`upgrade` fetches
the image at deploy time, stores it under `/industry-assets/` inside the pod, and
rewrites the ConfigMap to reference the local path — so the app always loads images
from the same origin with no external dependency at runtime.

**Option A — Generate images with your LLM (best quality, industry-specific):**

If the model you are using supports image generation (e.g. ChatGPT/DALL-E, Gemini/Imagen),
generate a logo and favicon inline during config creation:

1. Generate a logo PNG: a clean icon or wordmark that fits the brand (transparent or white
   background, at least 200×60 px for a wordmark or 128×128 px for an icon).
2. Generate a favicon PNG: a simple icon version of the logo (32×32 or 64×64 px).
3. Insert the generated image URLs directly into `theme.logo` and `theme.favicon`.

⚠️ **LLM-generated image URLs are often temporary** (DALL-E URLs expire in ~1–2 hours;
Gemini/Imagen URLs may expire similarly). The deploy script downloads the images at
`helm install` time — so if you deploy promptly after generating the config, the URLs
will still be live. If deployment is delayed, the URLs may expire and produce broken
images. In that case, redeploy after updating the URLs (or omit the fields to fall back
to the platform default).

**Option B — Use reliable public image sources:**

- ✅ **Unsplash** (hero photos): `https://images.unsplash.com/photo-<id>?w=1600&q=80`
- ✅ **GitHub raw** (for repos that actually exist): `https://raw.githubusercontent.com/<user>/<repo>/main/path.png`
- ✅ **Imgur direct**: `https://i.imgur.com/<id>.png`
- ✅ Any CDN or object storage URL that returns raw file bytes with no auth redirect

**Option C — Omit logo/favicon (safe default):**

Omit `theme.logo` and/or `theme.favicon` entirely. The platform renders the built-in
Meridian mark recolored to `theme.colors.brand` — looks correct and requires no external
image. Always prefer omitting over guessing a URL.

**URL requirements — applies to all options:**
- The URL must serve raw file bytes directly (no redirect to HTML, no login gate).
- ❌ Google Drive share links: `https://drive.google.com/file/d/.../view` — serves HTML
- ❌ Dropbox share links: `?dl=0` suffix — serves HTML preview
- ❌ Any URL requiring a cookie / session to download
- ❌ **Never invent a URL** (e.g. `raw.githubusercontent.com/yourcompany/...` for a repo
  that doesn't exist). A 404 is just as broken as an HTML redirect. Never add a comment
  like `# ⚠️ replace if needed` — that comment disappears at deploy time.

Specific fields:
- `theme.heroImage` — full-bleed background for the `welcome-hero` home module. Use a
  wide landscape photo (city skyline, hospital corridor, factory floor). Unsplash URLs
  work perfectly: `https://images.unsplash.com/photo-xxx?w=1600&q=80`
- `theme.favicon` — browser tab icon. LLM-generated, Imgur, or GitHub raw (verified repo).
  Omit to use the built-in Meridian mark recolored to `brand`.
- `theme.logo` — navbar logo image. LLM-generated, Imgur, or GitHub raw (verified repo).
  Omit to use the built-in Meridian mark recolored to `brand`.

### 4e. Company
```yaml
company:
  name: "<Full Brand Name>"
  short: "<Short Name>"
  tagline: "<one-line brand tagline>"
  assistant:
    name: "<Assistant name>"
    persona: "<one line: who the assistant is>"
    supportPhone: "<optional>"
    systemPrompt: |-
      <multi-line: what the assistant helps with, tone, industry context>
```

### 4f. Backend blocks (never rendered in the browser)

**`data.requestTemplates`** — realistic service request scenarios:
```yaml
data:
  requestTemplates:
    - { category: billing, title: "Incorrect charge on statement", description: "Customer was billed twice for the same service." }
    # aim for 10–15 entries across 3–5 categories
  chatQuestions:
    - "How do I dispute a charge?"
    # aim for 8–12 realistic questions
  zones: ["downtown", "north-district", "..."]   # operational zones/areas
```

**`routing`** — category → department (keys must match `data.requestTemplates` categories):
```yaml
routing:
  billing: "Billing & Accounts"
  technical: "Technical Support"
```

**`dynatrace`** — service naming + business flow config:

**`serviceNames` uses FIXED keys — the left side is the platform's internal service name, you only change the right side (the display label).** Do not invent left-side keys. The most commonly invented wrong keys are `grid-operations` (correct: `city-operations`) and `field-service` (correct: `service-dispatch`). Using an invented key silently renames nothing.

```yaml
# ❌ WRONG — invented keys are silently ignored
dynatrace:
  serviceNames:
    grid-operations: "Grid Control Center"   # ← wrong key, does nothing
    field-service: "Field Crew Dispatch"     # ← wrong key, does nothing

# ✅ CORRECT — use the fixed platform keys, customize the right side
dynatrace:
  serviceNames:
    # KEY (left side) = fixed platform name — copy these exactly
    # VALUE (right side) = your industry label — change freely
    citizen-service: "<Customer Portal display name>"  # customer-facing backend
    city-operations: "<Ops Center display name>"       # ops/incident backend — NOT grid-operations
    service-dispatch: "<Dispatch display name>"        # routing/dispatch — NOT field-service
    api-gateway: "<API Gateway display name>"
    notification-service: "<Notifications display name>"
  flowLabels:
    service-request: "<flow title>"
    account-creation: "<flow title>"
    iot-incident: "<flow title>"
    # include only flows you're enabling in `flows:`
  flows:
    - service-request
    - account-creation
    - iot-incident
    # add: tax-payment only if billing screen is active
    # add: aircraft-turnaround / passenger-journey only for aviation
    # ⚠️ The valid flow ids are EXACTLY: service-request, account-creation, iot-incident,
    # tax-payment, aircraft-turnaround, passenger-journey.
    # Do NOT invent flow ids (e.g. grid-fault-resolution, bill-payment-flow, etc.) —
    # they will silently do nothing. Map your concept to the closest valid id above.
```

---

## Step 5 — Validate before outputting

**Do these two things first, before all other checks:**

1. **Find `routing:` in your output. It must be a TOP-LEVEL key** (zero indent, same level as
   `terminology:`, `entities:`, `data:`, `dynatrace:`). If it is indented under `terminology:`,
   move it out to the top level.

2. **Look at your `routing:` block and find the line `other: ...`.** If it is not there, add it
   now: `other: "General Support"`. This line is missing in the majority of generated configs.
   Do not proceed until `other` is present in the top-level `routing:` block.

3. **Look at your `dynatrace.serviceNames` keys.** Delete any key that is not exactly one of:
   `citizen-service`, `city-operations`, `service-dispatch`, `api-gateway`,
   `notification-service`, `billing-service`. Common mistakes: `grid-operations` (must be
   `city-operations`), `field-service` (must be `service-dispatch`).

1. All `screens.public` / `screens.ops` ids are from the catalog (or use a valid `template`).
2. All `home.public` / `home.ops` ids are from the catalog (or use a valid `template`).
3. Every `template` entry has a unique `id` within its list.
4. Every entity `entityType` in a template screen/module is a key in the top-level `entities:` map.
5. Every `routing` key matches a `category` in `data.requestTemplates`.
6. All `dynatrace.flows` entries are from the known list; aviation flows excluded for non-transport industries.
7. `idPrefix` values contain no hyphens: `[a-z][a-z0-9]*`.
8. All `"y"` keys in `waypoints` blocks are quoted.
8b. `status-map` screens: `source` is `devices`, `viewBox` matches the background image's aspect ratio, `background.kind` is `image`, `background.src` is either a committed local file path or an HTTPS URL (not a relative path to an external asset).
9. State `tone` values are one of: `slate`, `blue`, `amber`, `orange`, `green`, `red`.
10. All state keys referenced in `transitions.from`/`to` and `steps` lists exist in `states`.
11. `version: 1` at the top.
12. YAML is valid with 2-space indent and a single top-level `industry:` block.
13. **Routing ↔ categories sync — bidirectional:** every key in `routing` must appear in
    `terminology.requestCategories`, AND every value in `terminology.requestCategories` must
    appear in `routing`. This includes `other` — if `other` is in categories (it always should be),
    it must also be in routing (e.g. `other: "General Support"`). A category with no routing key
    causes a 500 on form submit; a routing key with no matching category is dead config.
14. **Billing terminology present:** if `billing` appears in `screens.public`, then
    `terminology.billingTitle`, `terminology.billingSubtitle`, and `terminology.billNoun` are all
    defined. Without them the page shows "Tax & billing" and "tax bill" regardless of industry.
15. **Image URLs serve raw bytes:** `theme.heroImage`, `theme.logo`, and `theme.favicon` (when
    set) are direct-download URLs, not Google Drive/Dropbox share links. The init container uses
    `curl` without a browser session — share-link redirects produce broken images.
16. **`entity-journey` + `ownerField` only on user-created entity types.** If any `screens.public`
    entry uses `template: entity-journey` with an `ownerField`, verify that the same entity type
    does NOT rely solely on `generator: { strategy: simpleSteadyState }` to create instances.
    A generator never populates `ownerField`, so every user sees an empty journey. If the entity
    is generator-driven, replace the public screen with `status-map` (geographic/infrastructure
    view) or remove the `ownerField` and show all entities instead.
17. **Every `status-map` screen has a `background: { kind: image, src: ... }` block.** A
    status-map without a background renders blank — dots floating on white with no spatial context.
18. **`work_order` is reserved — do not define it as a custom entity.** Redefining it silently
    drops the incident-cascade effects that auto-resolve linked incidents when a work order closes,
    causing all device-map dots to accumulate permanently in "warning" state. Use a different name.
19. **Every auto-advancing transition has a `timer`.** A transition with only `when: { probability }`
    and no `timer` will never fire — the scheduler only processes records with `nextTransitionAt`
    set. Check every state: if it's not terminal and not `userTriggerable`-only, at least one
    outgoing transition must have a `timer`.
20. **Every entity type with a `generator` appears in at least one `screens` entry or `home`
    module.** A generator that creates invisible entities is wasted CPU. Surface it or remove it.
21. **Never fabricate image URLs.** Only use URLs you know exist: Unsplash photo IDs you've
    verified, GitHub raw URLs for repos that actually exist, or other known CDN URLs. An invented
    `raw.githubusercontent.com/org/repo/...` that 404s produces the same broken image as a
    Drive share link. **When in doubt, omit `theme.logo` and `theme.favicon`** — the platform's
    built-in defaults look correct; a 404 looks broken.
22. **No fabricated top-level keys.** The only valid top-level keys inside `industry:` are:
    `version`, `id`, `company`, `theme`, `terminology`, `screens`, `home`, `entities`, `data`,
    `routing`, `dynatrace`. Keys like `dynatraceFlowConfig`, `aiFeatures`, `businessFlows`,
    `deployConfig`, or any other invented section are silently ignored by the platform. Do not
    include them — they waste space and mislead readers.
23. **`ownerField` must reference a declared field.** If an `entity-journey` screen uses
    `ownerField: some_field`, verify that `some_field` exists in the entity type's `fields:` block.
    The engine does not add any implicit owner field — you must declare it explicitly.
24. **`tax-payment` flow when `billing` is in `screens.public`.** The flow that tracks bill payment
    is named `tax-payment` in the platform regardless of industry terminology. If `billing` is an
    active public screen, add `tax-payment` to `dynatrace.flows` and add a `flowLabels.tax-payment`
    entry with an industry-appropriate label (e.g. `"Electric Bill Payment"`, `"Invoice Payment"`).
25. **Bare screen/module ids must be from the catalog.** A bare string entry like `"outage-map"` or
    `{ id: "grid-map", label: "..." }` with no `template` key looks up a built-in screen by id.
    If that id isn't in the catalog table, the screen renders blank or errors. Always use a
    `template:` key for any domain-specific screen that isn't in the catalog.
26. **`dynatrace.serviceNames` keys are fixed — do not invent them.** The valid keys are exactly:
    `citizen-service`, `city-operations`, `service-dispatch`, `api-gateway`,
    `notification-service`, `billing-service`. A key like `grid-operations` or `analytics-engine`
    won't rename anything — it's silently ignored. Map your industry labels to these fixed keys.
27. **`dynatrace.flows` entries must be from the known list.** Valid flow ids: `service-request`,
    `account-creation`, `iot-incident`, `tax-payment`, `aircraft-turnaround`, `passenger-journey`.
    Any other string (e.g. `grid-fault-resolution`, `bill-payment-flow`) is silently ignored.
28. **`entity-journey` + `ownerField` never works for custom entity types in the public portal.**
    The portal has no mechanism to create custom entity type instances from user actions — only
    `service_request` records are created by the portal form. Entity-journey + ownerField is only
    valid for the built-in `my-journey` (aviation). For all other custom entities, use `entity-list`.
29. **Fleet/moving-map entities use `entityType: journey`, never a custom name.** If any
    `entity-map`/`entity-list` screen or home module is meant to show a moving fleet (trucks,
    vans, ships), its `entityType` must be exactly `journey`. A custom name like `truck` will
    404 — only `journey` is routed to journey-service.
30. **A `journey`-backed fleet map needs the top-level `journeyService` block.** If `entities.journey`
    is defined and used in a screen/home module, the config must also include a top-level
    `journeyService.generator` block (outside `industry:`) with `entityTypes`, `initialStatuses`,
    and a non-empty `routes` list — otherwise journey-service keeps generating flights/passengers
    (or nothing) and the fleet map stays empty.
31. **`entities.journey.states` keys must be a subset of `initiated`, `in_progress`, `completed`.**
    These status names are fixed globally in journey-service and are not configurable per industry.
    An invented status (e.g. `loading`, `customs`) will never be entered by the backend.
32. **`entities.journey` must not define `computed.position`.** Position for `journey` comes from
    journey-service's own origin/destination interpolation (`journeyService.generator.routes`), not
    from the generic waypoints mechanism. A `computed.position` block on `journey` is dead config.
33. **Route lines are not drawn automatically.** If routes should be visible on the map, add matching
    `line` shapes to `background.shapes` using the same coordinates as each entry in
    `journeyService.generator.routes` — otherwise only the moving sprites and hub markers show, with
    no connecting lines.

---

## Output format
1. A single fenced ```yaml block — the complete `values-<industry>.yaml`.
2. A **rationale** (3–6 bullets: why these entity types / screens / flows were chosen).
3. The **deploy command**:
   ```
   # save as helm/values-<industry>.yaml, then:
   ./scripts/deploy.sh install -f helm/values-custom.yaml -f helm/values-<industry>.yaml

   # validate the schema first (recommended):
   node scripts/validate-industry-config.mjs helm/values-<industry>.yaml
   ```

---

## Worked example A — Meridian Airport (aviation, with entity types)

```yaml
industry:
  version: 1
  id: airport
  company:
    name: "Meridian Airport"
    short: "Meridian"
    tagline: "Every journey, on time."
    assistant:
      name: "Skye"
      persona: "the Meridian Airport virtual assistant"
      supportPhone: "1-555-FLY-MERID"
      systemPrompt: |-
        You are Skye, the virtual assistant for Meridian Airport. Help passengers with
        flight status, gates, parking, security waits, lounges, and baggage. Be concise,
        warm, and stay in character.
  theme:
    colors:
      brand: "#0B3D91"
      brandDeep: "#072A63"
      brandSoft: "#2563EB"
      brandTint: "#E7EEFB"
      accent: "#06B6D4"
      accentSoft: "#38BDF8"
      accentInk: "#062B36"
  terminology:
    customer: "Passenger"
    customerPlural: "Passengers"
    asset: "Ground equipment"
    assetPlural: "Ground equipment"
    requestCategories: [airfield, baggage, lost-item, accessibility, flight-query, other]
  screens:
    public:
      - home
      - { id: my-journey, label: "My Journey" }
      - { id: service-requests, label: "Help & requests" }
      - messages
    ops:
      - overview
      - { id: flight-board, label: "Flight Board" }
      - { id: airfield, label: "Airfield" }
      - { id: requests, label: "Maintenance queue" }
      - { id: iot, label: "Ground equipment" }
      - { id: incidents, label: "Operational incidents" }
      - { id: analytics, label: "On-time performance" }
      - demo-control
  home:
    public:
      - id: departures
        template: ticker
        height: slim
        label: "✈️ DEPARTURES"
        items:
          - "MC501  New York JFK  14:30  BOARDING"
          - "MC302  Chicago ORD  15:00  ON TIME"
          - "MC817  Los Angeles LAX  16:45  DELAYED 20 min"
      - flight-status
      - airfield-map
      - my-journey
      - quick-actions
    ops:
      - { id: summaries, template: entity-kpi-row, entityTypes: [flight_departure, flight_arrival, passenger], label: "Live Operations" }
      - flight-summary
      - ops-overview
  entities:
    flight_departure:
      displayName: "Departure"
      displayNamePlural: "Departures"
      idPrefix: fltd
      fields:
        flight_number: { type: string, required: true }
        airline:       { type: string }
        destination:   { type: string }
        gate:          { type: string }
      initial: at_gate
      states:
        at_gate:   { label: "At Gate",  tone: blue }
        boarding:  { label: "Boarding", tone: amber }
        taxiing:   { label: "Taxiing",  tone: orange }
        takeoff:   { label: "Takeoff",  tone: blue }
        departed:  { label: "Departed", tone: green, terminal: true, isKpi: true }
        cancelled: { label: "Cancelled", tone: red, terminal: true, isError: true }
      transitions:
        - { from: at_gate,  to: boarding,  timer: { minSeconds: 30, maxSeconds: 120 } }
        - { from: boarding, to: cancelled, when: { faultGate: true, probability: 0.08 } }
        - { from: boarding, to: taxiing,   timer: { minSeconds: 20, maxSeconds: 60 } }
        - { from: taxiing,  to: takeoff,   timer: { minSeconds: 15, maxSeconds: 45 } }
        - { from: takeoff,  to: departed,  timer: { minSeconds: 10, maxSeconds: 30 } }
      computed:
        position:
          type: point2d
          interpolation: easeInOut
          waypoints:
            at_gate:   { x: 197, "y": 99  }
            boarding:  { x: 197, "y": 159 }
            taxiing:   { x: 310, "y": 182 }
            takeoff:   { x: 620, "y": 260 }
            departed:  { x: 895, "y": 240 }
            cancelled: { x: 197, "y": 219 }
      generator: { strategy: simpleSteadyState, intervalMs: 25000, maxActive: 10 }
  data:
    zones: [terminal-1, terminal-2, concourse-a, airfield, baggage-hall]
    requestTemplates:
      - { category: airfield, title: "FOD debris on Taxiway C", description: "Foreign object debris near intersection B." }
      - { category: baggage, title: "Carousel 4 jammed", description: "Bags backing up on belt 4." }
    chatQuestions:
      - "Which gate does my flight leave from?"
      - "How long is the security wait?"
  routing:
    airfield: "Airfield Operations"
    baggage: "Baggage Handling"
    lost-item: "Lost & Found"
    accessibility: "Passenger Assistance"
    flight-query: "Passenger Services"
    other: "General Support"
  dynatrace:
    serviceNames:
      citizen-service: "Passenger Services"
      city-operations: "Airfield Operations"
      service-dispatch: "Operations Dispatch"
      api-gateway: "Airport API Gateway"
    flowLabels:
      service-request: "Maintenance Request Lifecycle"
      account-creation: "Passenger Registration"
    flows: [service-request, account-creation, iot-incident, aircraft-turnaround, passenger-journey]
```

---

## Worked example B — Meridian Health (hospital, non-aviation, custom entity)

This example shows a custom `patient_admission` entity with a journey tracker.

```yaml
industry:
  version: 1
  id: health
  company:
    name: "Meridian Health"
    short: "Meridian Health"
    tagline: "Your health, our priority."
    assistant:
      name: "Cara"
      persona: "the Meridian Health patient support assistant"
      systemPrompt: |-
        You are Cara, the virtual assistant for Meridian Health. Help patients with
        appointment scheduling, billing questions, and navigating the facility. Be
        empathetic, clear, and never give clinical advice — escalate medical questions
        to clinical staff.
  theme:
    colors:
      brand: "#0D5C84"
      brandDeep: "#083D5C"
      brandSoft: "#1A7FA8"
      brandTint: "#E6F4FA"
      accent: "#00A86B"
      accentSoft: "#4CC8A0"
      accentInk: "#004D31"
  terminology:
    customer: "Patient"
    customerPlural: "Patients"
    request: "Support request"
    requestPlural: "Support requests"
    incident: "Clinical incident"
    incidentPlural: "Clinical incidents"
    asset: "Medical equipment"
    assetPlural: "Medical equipment"
    requestCategories: [billing, facilities, equipment, administrative, care-concern, other]
    billingTitle: "Billing & Accounts"
    billingSubtitle: "Your Meridian Health invoices and payment history."
    billNoun: "invoice"
  screens:
    public:
      - home
      # entity-journey with ownerField CANNOT be used here: patient_admission is generator-driven
      # and generators never populate patient_id with a citizen ID. Use entity-list instead to show
      # the live admission pipeline as a public-facing activity feed.
      - { id: admissions-live, template: entity-list, entityType: patient_admission,
          label: "Admissions Today", icon: "🏥" }
      - { id: service-requests, label: "Support" }
      - billing
      - messages
    ops:
      - overview
      - { id: admissions, template: entity-list, entityType: patient_admission, label: "Admissions" }
      - requests
      - incidents
      - iot
      - analytics
      - demo-control
  home:
    public:
      - welcome-hero
      - { id: weather, template: weather-widget, mode: perfect }
      - quick-actions
      - chat-teaser
    ops:
      - { id: admit-kpi, template: entity-summary-card, entityType: patient_admission, label: "Admissions Today" }
      - ops-overview
      - { id: feed, template: activity-feed, entityTypes: [patient_admission], maxItems: 8 }
  entities:
    patient_admission:
      displayName: "Admission"
      displayNamePlural: "Admissions"
      idPrefix: adm
      fields:
        patient_id:   { type: string }
        patient_name: { type: string }
        ward:         { type: enum, values: [emergency, cardiology, orthopedics, general, icu] }
        priority:     { type: enum, values: [routine, urgent, critical] }
      initial: registered
      states:
        registered:          { label: "Registered",          tone: slate }
        triage:              { label: "Triage",              tone: amber }
        admitted:            { label: "Admitted",            tone: blue }
        in_treatment:        { label: "In Treatment",        tone: blue }
        ready_for_discharge: { label: "Ready for Discharge", tone: green, isKpi: true }
        discharged:          { label: "Discharged",          tone: green, terminal: true }
        transferred:         { label: "Transferred",         tone: orange, terminal: true, isError: true }
      transitions:
        - { from: registered, to: triage,              timer: { minSeconds: 60, maxSeconds: 300 } }
        - { from: triage,     to: admitted,            timer: { minSeconds: 120, maxSeconds: 600 } }
        - { from: triage,     to: transferred,         when: { faultGate: true, probability: 0.05 }, timer: { minSeconds: 120, maxSeconds: 600 } }
        - { from: admitted,   to: in_treatment,        timer: { minSeconds: 300, maxSeconds: 900 } }
        - { from: in_treatment, to: ready_for_discharge, timer: { minSeconds: 600, maxSeconds: 3600 } }
        - { from: ready_for_discharge, to: discharged, timer: { minSeconds: 120, maxSeconds: 600 } }
      generator: { strategy: simpleSteadyState, intervalMs: 40000, maxActive: 20 }
  data:
    zones: [emergency, cardiology, orthopedics, general-medicine, icu, outpatient]
    requestTemplates:
      - { category: billing, title: "Incorrect charge on bill", description: "Patient billed for a procedure not received." }
      - { category: billing, title: "Insurance coordination question", description: "Patient unsure how to submit insurance claim for stay." }
      - { category: facilities, title: "Room temperature complaint", description: "Room 214 is too cold." }
      - { category: equipment, title: "Wheelchair request", description: "Patient needs mobility assistance to exit." }
      - { category: administrative, title: "Medical records request", description: "Discharge summary needed for primary care." }
    chatQuestions:
      - "What are visiting hours?"
      - "How do I request my medical records?"
      - "I have a question about my bill."
  routing:
    billing: "Patient Billing"
    facilities: "Facilities Management"
    equipment: "Clinical Equipment Services"
    administrative: "Patient Relations"
    care-concern: "Clinical Quality"
    other: "General Support"         # 'other' is in requestCategories so it must be here too
  dynatrace:
    serviceNames:
      citizen-service: "Patient Services"
      city-operations: "Clinical Operations"
      service-dispatch: "Care Coordination"
      api-gateway: "Health API Gateway"
      notification-service: "Patient Notifications"
      billing-service: "Patient Billing Service"
    flowLabels:
      service-request: "Support Request Lifecycle"
      account-creation: "Patient Registration"
      iot-incident: "Equipment Incident Resolution"
      tax-payment: "Bill Payment Flow"
    flows: [service-request, account-creation, iot-incident, tax-payment]
```

---

## Worked example C — Meridian Freight (trucking/logistics, journey-service fleet map)

This example shows the `journey` fleet-map pattern from Step 3b: a schematic-map
background drawn with `shapes`, routes branching from one hub, and the required
top-level `journeyService` block.

```yaml
industry:
  version: 1
  id: trucking
  company:
    name: "Meridian Freight"
    short: "Meridian"
    tagline: "On time, every mile."
    assistant:
      name: "Dispatch"
      persona: "the Meridian Freight virtual assistant"
      systemPrompt: |-
        You are Dispatch, the virtual assistant for Meridian Freight, a regional
        trucking carrier. Help shippers track deliveries, report delivery issues,
        and pay freight invoices. Be concise and professional.
  theme:
    colors:
      brand: "#B45309"
      brandDeep: "#78350F"
      brandSoft: "#D97706"
      brandTint: "#FEF3E2"
      accent: "#1E293B"
      accentSoft: "#334155"
      accentInk: "#F1F5F9"
  terminology:
    customer: "Shipper"
    customerPlural: "Shippers"
    asset: "Truck"
    assetPlural: "Trucks"
    requestCategories: [damaged-cargo, delivery-delay, missed-pickup, other]
  screens:
    public:
      - home
      - { id: service-requests, label: "Delivery issues" }
      - messages
    ops:
      - overview
      - id: fleet-map
        template: entity-map
        entityType: journey          # ALWAYS "journey" — see Step 3b
        label: "Fleet Map"
        icon: "🚚"
        viewBox: "0 0 1000 600"
        labelField: destination
        background:
          kind: shapes
          shapes:
            - { type: rect, x: 40, "y": 30, width: 920, height: 540, fill: "#0f172a", stroke: "#334155", "stroke-width": 2, rx: 12 }
            - { type: circle, cx: 500, cy: 300, r: 8, fill: "#fbbf24" }
            - { type: text, x: 500, "y": 285, text: "Hub City", fill: "#e2e8f0", "font-size": 13, "font-weight": bold, "text-anchor": middle }
            - { type: circle, cx: 750, cy: 180, r: 7, fill: "#38bdf8" }
            - { type: text, x: 750, "y": 165, text: "North Depot", fill: "#cbd5e1", "font-size": 12, "text-anchor": middle }
            # route line must match journeyService.generator.routes coordinates below
            - { type: line, x1: 500, "y1": 300, x2: 750, "y2": 180, stroke: "#475569", "stroke-width": 2, "stroke-dasharray": "4 3" }
      - { id: requests, label: "Dispatch queue" }
      - demo-control
  home:
    ops:
      - ops-overview
  entities:
    journey:                          # frontend rendering only — NOT the state machine
      displayName: "Shipment"
      displayNamePlural: "Shipments"
      fields:
        origin:      { type: string }
        destination: { type: string }
        status:      { type: enum, values: [in_progress, completed] }
      initial: in_progress
      states:                         # must be a subset of initiated/in_progress/completed
        in_progress: { label: "En route",  tone: blue,  glyph: "🚚" }
        completed:   { label: "Delivered", tone: green, glyph: "✅", terminal: true }
      transitions:
        - { from: in_progress, to: completed }
  data:
    zones: [hub-city, north-depot]
    requestTemplates:
      - { category: damaged-cargo,  title: "Pallet damaged in transit", description: "Shipment arrived with a crushed pallet." }
      - { category: delivery-delay, title: "Delivery running behind",   description: "Driver reports a highway closure." }
    chatQuestions:
      - "Where is my shipment right now?"
  routing:
    damaged-cargo:  "Claims & Damage Resolution"
    delivery-delay: "Dispatch Operations"
    missed-pickup:  "Dispatch Operations"
    other:          "General Support"
  dynatrace:
    serviceNames:
      citizen-service: "Shipper Portal"
      service-dispatch: "Dispatch Operations"
    flowLabels:
      service-request: "Delivery Issue Resolution"
    flows: [service-request]

# journeyService — TOP LEVEL, outside industry:. This is what actually makes the
# fleet map move: without it, entityType: journey renders an empty map (or
# flights/passengers, journey-service's own defaults).
journeyService:
  lifecycle:
    minSeconds: 20    # shortened from the 300-7200s default so movement is
    maxSeconds: 60    # visible within a normal demo session
  generator:
    maxActive: 10
    entityTypes: ["truck"]           # cosmetic label on generated records only
    initialStatuses:
      truck: "in_progress"           # skip "initiated"
    routes:
      - { origin: "Hub City", destination: "North Depot",
          originX: 500, originY: 300, destX: 750, destY: 180 }
```

---

Now begin at **Step 1** and ask the SE about their industry.

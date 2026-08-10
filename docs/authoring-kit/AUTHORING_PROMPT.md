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
| `{ template: 'entity-journey', entityType: '<type>', ownerField: '<field>', steps: [...] }` | Personal journey tracker — shows the logged-in user's own entities | **Only when the entity is created by the user** (form submission, purchase, registration). Never for generator-driven entities — see warning below. |
| `{ template: 'status-map', source: 'devices', background: {...}, ... }` | Geographic/infrastructure status map with live colored dots | "Show me what's happening in my area" — outage maps, ATM finders, parking lots, grid status |

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

**Choosing between `entity-journey` and `status-map` for a public portal screen:**

| User intent | Right template | Wrong template |
|-------------|---------------|----------------|
| "Track *my* loan / claim / order" | `entity-journey` | `status-map` |
| "See where outages are happening near me" | `status-map` | `entity-journey` |
| "Check the status of grid/ATM/parking infrastructure" | `status-map` | `entity-journey` |
| "See my appointment / admission status" | `entity-journey` | `status-map` |

**⚠️ Critical constraint — `entity-journey` + `ownerField` only works when the user creates the entity.**

`ownerField` tells the journey screen which entities belong to the logged-in user: it filters entities where `ownerField == user.id`. This only returns results when the entity was created with that field set to a real citizen ID — which only happens through **user-initiated actions** (submitting a form, placing an order, completing a registration).

If the entity uses `generator: { strategy: simpleSteadyState }`, the generator creates entities with no knowledge of any citizen ID, so `ownerField` is never populated. Every logged-in user sees an empty journey. **Do not combine `entity-journey` + `ownerField` with a generator-driven entity type.**

✅ **Good `entity-journey` candidates** (user-created entities):
- Loan application (user fills the form → entity created with their ID)
- Patient admission (check-in creates the entity)
- Insurance claim (user submits → entity created)
- Store order (purchase flow creates the entity)

❌ **Bad `entity-journey` candidates** (backend-generated, no owner link):
- Outage event, grid fault, IoT incident → use `status-map` instead
- Flight / shipment / work order → ops-side only, use `entity-list` or `entity-map`

**Template screen extra props (entity-journey):**
```yaml
- id: my-claims              # unique id, lowercase-hyphen
  template: entity-journey
  entityType: claim          # must be a key in top-level entities
  label: "My Claims"         # nav label
  icon: "📋"
  ownerField: owner_id       # portal only: entity field = current user's id
                             # ONLY works if entities are created with this field
                             # set to the user's citizen ID (e.g. via a form submission)
  steps:                     # optional: only these states shown as journey steps
    - submitted
    - under_review
    - approved
    - paid
  description: "Track your insurance claim, step by step."
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
| `flight-summary` | Live flight KPI strip | aviation only |

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

```yaml
# Good: categories ↔ routing are in sync
terminology:
  requestCategories: [account-issue, card-dispute, loan-inquiry, fraud-report, password-reset, other]
routing:
  account-issue: "Retail Banking"
  card-dispute: "Card Operations"
  loan-inquiry: "Lending"
  fraud-report: "Fraud Detection"
  password-reset: "Digital Support"
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

**URL requirements — the download URL must serve the raw file bytes directly, with no
redirect to a login page or HTML preview.** Never invent or guess a URL — only use URLs
you can verify actually exist and return the image. A 404 from a fabricated GitHub raw
URL is just as broken as an HTML page from a Drive share link. These URL types do NOT work:
- ❌ Google Drive share links: `https://drive.google.com/file/d/.../view` — serves HTML
- ❌ Dropbox share links: `?dl=0` suffix — serves HTML preview
- ❌ Any URL requiring a cookie / session to download

Use one of these reliable sources instead:
- ✅ **Unsplash** (photos): `https://images.unsplash.com/photo-<id>?w=1600&q=80`
- ✅ **GitHub raw**: `https://raw.githubusercontent.com/<user>/<repo>/main/path/to/image.png`
- ✅ **Imgur direct**: `https://i.imgur.com/<id>.png`
- ✅ Any CDN or object storage URL that returns the raw file with no auth gate

Specific fields:
- `theme.heroImage` — full-bleed background for the `welcome-hero` home module. Use a
  wide landscape photo (city skyline, hospital corridor, factory floor). Unsplash URLs
  work perfectly: `https://images.unsplash.com/photo-xxx?w=1600&q=80`
- `theme.favicon` — browser tab icon. Supply a PNG or ICO direct URL, or omit to use
  the built-in Meridian mark recolored to `brand`.
- `theme.logo` — navbar logo image. Supply a PNG/SVG direct URL, or omit to use the
  built-in Meridian mark recolored to `brand`.

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
```yaml
dynatrace:
  serviceNames:
    citizen-service: "<display name>"     # the customer-facing backend
    city-operations: "<display name>"     # the ops/incident backend
    service-dispatch: "<display name>"    # the routing/dispatch backend
    api-gateway: "<display name>"
    notification-service: "<display name>"
  flowLabels:
    service-request: "<flow title>"
    account-creation: "<flow title>"
    iot-incident: "<flow title>"
    # include only flows you're enabling in `flows:`
  flows:
    - service-request
    - account-creation
    - iot-incident
    # add: purchase / tax-payment only if store/billing screens are active
    # add: aircraft-turnaround / passenger-journey only for aviation
```

---

## Step 5 — Validate before outputting

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
13. **Routing ↔ categories sync:** every key in `routing` appears in `terminology.requestCategories`.
    A routing key with no matching category means users can never submit that category through the
    form — and the default city categories will be shown, which make no sense for non-city industries.
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
    Drive share link.

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
      - { id: my-admission, template: entity-journey, entityType: patient_admission,
          label: "My Admission", icon: "🏥", ownerField: patient_id,
          steps: [registered, triage, admitted, in_treatment, ready_for_discharge, discharged],
          description: "Track your care journey from registration to discharge." }
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
        - { from: triage,     to: transferred,         when: { faultGate: true, probability: 0.05 } }
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

Now begin at **Step 1** and ask the SE about their industry.

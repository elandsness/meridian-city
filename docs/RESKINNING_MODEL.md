# Meridian Reskinning Model

This document describes the conceptual reskinning model for the Meridian demo
platform — the mental model, not the authoritative DSL reference. For the
current, maintained config contract (every key, the full screen/module catalog,
and the platform rules the DSL alone doesn't cover), use
[authoring-kit/README.md](authoring-kit/README.md) and
[authoring-kit/AUTHORING_PROMPT.md](authoring-kit/AUTHORING_PROMPT.md) instead —
some specifics below (fixed Dynatrace flow catalog, stale service names,
example files) are superseded; they're kept here only where they still
illustrate the underlying idea.

## Overview

The Meridian platform is **generic by design**. A single codebase can be reskinned for any industry (airport, bank, hospital, sports team, utility, oil & gas) via a single YAML config file (`helm/values-<industry>.yaml`).

**Zero code changes are required for reskinning.** If a reskin requires code changes, the platform is not generic.

### Two Orthogonal Axes

A deployment is defined by two orthogonal axes:

1. **Instance** (`meridian-<hash>`) — multi-tenancy. Isolates infrastructure, tenant identity, and Dynatrace. Already built.
2. **Industry** (the `industry:` block in Helm values) — branding, terminology, screens, flows, data, Dynatrace display names. This is the reskinning axis.

```
deploy = (instanceHash, industry)
  instanceHash → infra + tenant identity isolation   (existing)
  industry     → branding, terminology, screens, flows, data   (NEW)
```

App workload names (`api-gateway`, `identity-service`, `customer-entity-service`, etc.) stay plain and namespace-isolated. The industry axis changes what the **user** and **Dynatrace** see, not the k8s object names.

## What Can Be Configured

### 1. Branding

```yaml
industry:
  company:
    name: "Meridian Airport"        # shown to end users
    short: "Meridian"               # short name
    tagline: "Every journey, on time."
    assistant:
      name: "Skye"                  # AI assistant name
      persona: "the Meridian Airport virtual assistant"
      supportPhone: "1-555-FLY-MERID"  # optional
      systemPrompt: |-              # optional — keeps assistant in character
        You are Skye, the virtual assistant for Meridian Airport...
  theme:
    colors:
      brand: "#0B3D91"              # primary brand color
      brandDeep: "#072A63"          # darker shade
      brandSoft: "#2563EB"          # lighter shade
      brandTint: "#E7EEFB"          # very light background tint
      accent: "#06B6D4"             # secondary/accent
      accentSoft: "#38BDF8"
      accentInk: "#062B36"          # dark text that reads on the accent
    logo: "/meridian-airport-logo.svg"
    favicon: "/meridian-airport-logo.svg"
```

### 2. Terminology

Maps generic nouns to industry-specific terms. All optional.

```yaml
industry:
  terminology:
    customer: "Passenger"
    customerPlural: "Passengers"
    request: "Maintenance ticket"
    requestPlural: "Maintenance tickets"
    incident: "Operational incident"
    incidentPlural: "Operational incidents"
    workOrder: "Work order"
    asset: "Ground equipment"
    assetPlural: "Ground equipment"
```

### 3. Screens

Define which screens appear in the passenger/citizen portal. Pick from the catalog, relabel, and hide what doesn't apply. (ops-dashboard is a fixed Command Center + Demo Control app — it doesn't read a `screens.ops` list; see "Ops Dashboard" below.)

```yaml
industry:
  screens:
    public:                           # passenger portal
      - home
      - { id: my-journey, label: "My Journey" }
      - { id: service-requests, label: "Help & requests" }
      - messages
```

**Portal screens catalog:**

| id | What it is | Use for |
|----|-----------|---------|
| `home` | Landing page (contents from `home.public` modules) | always |
| `service-requests` | Submit + track requests/issues | generic — relabel per industry |
| `store` | Online store + orders | only if the industry sells goods |
| `billing` | Pay bills / fees | only if the industry bills customers |
| `messages` | Notifications inbox | generic |
| `my-journey` | Personal step-by-step journey tracker | aviation / transport only |

### Ops Dashboard

ops-dashboard is **not** config-composable — it's a fixed two-screen app
(Command Center + Demo Control) for every industry. Command Center discovers
whatever business flows/entity types the loaded industry config defines (via
entity-engine's `GET /api/v1/entity-types` and journey-service) and renders
them generically, so there's nothing to pick/relabel/hide per industry here.

### 4. Home Page Modules

Compose the portal home page from a library of generic components. Modules are rendered by the `PageComposer` from the `COMPONENT_REGISTRY`. (ops-dashboard has no home-module composition — see "Ops Dashboard" above.)

```yaml
industry:
  home:
    public:
      - { id: city-home, label: "Welcome" }
      - { id: news-ticker, label: "Flight Updates", headlines: ["Flight 123 On Time", "Flight 456 Delayed 30 min"] }
      - { id: transit-map, label: "Shuttle Map" }
      - { id: weather, label: "Airport Weather", location: "Meridian Airport", units: "fahrenheit" }
```

#### Configurable Components

The following home modules are now configurable:

| Module ID | Config Fields | Example |
|-----------|---------------|---------|
| `weather` | `location` (string), `units` ('fahrenheit' \| 'celsius') | `{ id: weather, location: "Meridian Airport", units: "fahrenheit" }` |
| `news-ticker` | `headlines` (array of strings) | `{ id: news-ticker, headlines: ["Flight 123 On Time", "Gate B12 Closed"] }` |
| `transit-map` | `routes` (array of {name, stops[]}) | `{ id: transit-map, routes: [{ name: "Shuttle 1", stops: ["A", "B"] }] }` |
| `chat-widget` | `assistantName` (string), `assistantPersona` (string) | `{ id: chat-widget, assistantName: "Bank Assistant", assistantPersona: "..." }` |

#### Component Library

The `COMPONENT_REGISTRY` maps component IDs to React components. This is the contract between the config layer and the UI layer.

| Component ID | React Component | Description |
|-------------|-----------------|-------------|
| `weather` | `WeatherWidget` | Configurable weather display |
| `news-ticker` | `NewsTicker` | Configurable news ticker |
| `transit-map` | `TransitPanel` | Configurable transit route display |
| `chat-widget` | `ChatWidget` | Configurable chat assistant |
| `entity-list` | `EntityListPage` | Generic entity list |
| `entity-detail` | `EntityDetailPage` | Generic entity detail view |
| `entity-map` | `EntityMapPage` | Generic entity map |
| `entity-analytics` | `EntityAnalyticsPage` | Generic analytics dashboard |
| `entity-journey` | `EntityJourneyPage` | Generic entity journey tracker |
| `status-map` | `StatusMapPage` | Generic status map (for IoT/asset fleet) |

Registry location: `frontends/public-portal/src/config/componentRegistry.jsx`.

#### Page Composer

The `PageComposer` renders a page from config. It looks up each module's `type` in the `COMPONENT_REGISTRY` and renders the corresponding React component, spreading the module object as props (minus `type` and `position`), plus the full `config` for branding/terminology access.

```jsx
// PageComposer renders a page from the industry config.
// config.pages[pageId].modules = [
//   { type: 'weather', position: 'top', location: 'Meridian Airport', units: 'fahrenheit' },
//   { type: 'news-ticker', position: 'top', headlines: ['Flight 123 On Time'] },
//   { type: 'entity-list', position: 'main', entityType: 'flight' },
// ]

// `position` controls layout:
//   - 'top' / undefined: standard grid cell (1/2 on md+)
//   - 'main': standard grid cell
//   - 'full': spans both columns (col-span-2)
//   - 'sidebar': rendered in a sidebar slot (currently treated as standard cell)
```

### 5. Entity Definitions

Define custom domain entities with typed fields and lifecycle state machines. Used by the generic entity engine.

```yaml
industry:
  entities:
    outage:
      displayName: "Outage"
      displayNamePlural: "Outages"
      idPrefix: out
      fields:
        zone:          { type: string }
        location:      { type: string }
        severity:      { type: enum, values: [minor, moderate, major, critical] }
        cause:         { type: enum, values: ["weather", "equipment-fail", "vehicle-accident", "animal", "unknown"] }
        affected_customers: { type: number }
      initial: reported
      states:
        reported:         { label: "Reported",            tone: slate }
        acknowledged:     { label: "Acknowledged",        tone: amber }
        diagnosing:       { label: "Diagnosing",          tone: orange }
        repairing:        { label: "Repair In Progress",  tone: red }
        restored:         { label: "Power Restored",      tone: green, terminal: true, isKpi: true }
      transitions:
        - from: reported
          to: acknowledged
          timer: { minSeconds: 15, maxSeconds: 60 }
        - from: acknowledged
          to: diagnosing
          timer: { minSeconds: 30, maxSeconds: 180 }
        - from: diagnosing
          to: repairing
          when: { probability: 0.7 }
          timer: { minSeconds: 60, maxSeconds: 300 }
        - from: repairing
          to: restored
          timer: { minSeconds: 120, maxSeconds: 1800 }
      computed:
        position:
          type: point2d
          interpolation: easeInOut
          waypoints:
            reported:         { x: 200, "y": 100 }
            acknowledged:     { x: 350, "y": 200 }
            diagnosing:       { x: 500, "y": 150 }
            repairing:        { x: 650, "y": 250 }
            restored:         { x: 800, "y": 200 }
      generator:
        strategy: simpleSteadyState
        intervalMs: 45000
        maxActive: 8
```

### 6. Backend Data + Routing

Backend-only blocks (delivered to services, NOT shown in the browser).

```yaml
industry:
  data:
    zones:
      - terminal-1
      - terminal-2
      - concourse-a
      - airfield
      - baggage-hall
    requestTemplates:
      - { category: terminal, title: "Jet bridge stuck at gate B12", description: "The passenger boarding bridge at gate B12 is stuck." }
      - { category: baggage, title: "Baggage carousel 4 jammed", description: "Carousel 4 in the baggage hall has jammed." }
      - { category: airfield, title: "FOD debris on Taxiway C", description: "Foreign object debris reported on Taxiway C." }
    chatQuestions:
      - "How long is the security wait at Terminal 1?"
      - "Which gate does my flight leave from?"
      - "Where do I report lost or delayed baggage?"
  routing:
    terminal: "Terminal Operations"
    baggage: "Baggage Handling"
    airfield: "Airfield Operations"
    security: "Security & Screening"
    facilities: "Facilities Management"
    ground-transport: "Ground Transportation"
```

### 7. Dynatrace Configuration

Reskin the Dynatrace service map and business flows. Two mechanisms:

- **serviceNames:** Rename OneAgent services in the Dynatrace service map. Keys
  must be exact, current service names — the key list itself is fixed, but
  which entity types become Business Flows is not (see below).
- **flowLabels / flows:** `flows` is **not** a fixed catalog you pick from —
  each entry must be the exact key of an `industry.entities` type that defines
  a `states` state machine + `initial`; the provisioner derives one Business
  Flow per listed type automatically, with steps named `<entity_type>.<state>`.
  `flowLabels` supplies the display label for each.

```yaml
industry:
  dynatrace:
    serviceNames:
      customer-entity-service: "Passenger Services"
      ops-entity-service: "Airfield Operations"
      identity-service: "Passenger Identity"
      journey-service: "Ground Vehicle Journeys"
      movement-service: "Ground Vehicle Movement"
      routing-service: "Operations Dispatch"
      workflow-service: "Airport Workflow"
      api-gateway: "Airport API Gateway"
      notification-service: "Passenger Notifications"
      billing-service: "Airport Fees"
    flowLabels:
      passenger_request: "Maintenance Request Lifecycle"
      passenger: "Passenger Journey"
    flows:
      - passenger_request
      - passenger
```

**Service names you may rename:** the fixed key list is `customer-entity-service`,
`ops-entity-service`, `identity-service`, `journey-service`, `movement-service`,
`routing-service`, `workflow-service`, `api-gateway`, `notification-service`,
`billing-service`. Invented keys are silently ignored.

**Flow ids:** not a fixed catalog — any key of an `industry.entities` type with
`states`/`initial` works. There is no more hardcoded legacy list (the old
`service-request`/`tax-payment`/`aircraft-turnaround`-style ids some earlier
configs used were removed from the provisioner entirely).

## What Cannot Be Configured

The following require code changes:

1. **New screen types** — The screen registry is fixed. You can't add a new screen type without code.
2. **New home module types** — The home module registry (component library) is fixed. You can't add a new module type without code.
3. **New entity field types** — The entity field types are fixed (string, number, enum, boolean, point2d, ref). You can't add a new field type without code.
4. **New `dynatrace.serviceNames` keys** — that key list is fixed to the platform's real service names. (Business Flow ids, by contrast, are *not* fixed — see §7.)

## How to Reskin

### Quick Start

1. **Copy an existing industry config:**
   ```bash
   cp helm/values-airport.yaml helm/values-<new-industry>.yaml
   ```

2. **Edit the config:**
   - Change `industry.id`
   - Change `industry.company.name`, `company.short`, `company.tagline`
   - Change `industry.theme.colors` (hex)
   - Change `industry.terminology`
   - Change `industry.screens` (pick from catalog, relabel, hide what doesn't apply)
   - Change `industry.home.public` (compose from component library)
   - Change `industry.data` (zones, requestTemplates, chatQuestions)
   - Change `industry.routing` (must match requestTemplates categories)
   - Change `industry.dynatrace` (serviceNames, flowLabels, flows)
   - Change `industry.entities` (if adding new entity types)

3. **Validate the config:**
   ```bash
   helm template meridian helm/ -f helm/values-custom.yaml -f helm/values-<new-industry>.yaml >/dev/null && echo OK
   ```

4. **Deploy:**
   ```bash
   ./scripts/deploy.sh install -f helm/values-custom.yaml -f helm/values-<new-industry>.yaml
   ```

### Using the Authoring Kit (LLM-Assisted)

For a faster reskin, use the Meridian Industry Authoring Kit:

1. Open [`docs/authoring-kit/AUTHORING_PROMPT.md`](./authoring-kit/AUTHORING_PROMPT.md) and copy everything below the `---` line.
2. Paste it into any capable LLM (ChatGPT, Claude, Gemini, Copilot...).
3. Answer its questions (industry, brand name, colors, what to showcase).
4. It researches the domain and outputs a complete `values-<industry>.yaml`.
5. Save it as `helm/values-<industry>.yaml`.
6. Validate and deploy as above.

## Example: Airport vs. NHVR (trucking regulator)

Both configs below actually ship in the repo — [`helm/values-airport.yaml`](../helm/values-airport.yaml)
and [`helm/values-nhvr.yaml`](../helm/values-nhvr.yaml) — so read them end-to-end
for the real, current, complete shape rather than a hand-trimmed excerpt here.
The shape to notice, side by side:

| | Airport | NHVR |
|---|---|---|
| `company.name` | Meridian International Airport | National Heavy Vehicle Regulator |
| `terminology.customer` | Passenger | Operator |
| Moving fleet (`journeyService`) | ground vehicles between gates/stands | trucks between depots/hubs |
| `industry.entities` | e.g. a passenger/flight-shaped set, `domain: customer`/`ops` per type | permits/inspections-shaped set |
| `dynatrace.flows` | the keys of its own `industry.entities` types | the keys of its own `industry.entities` types |

The public portal, ops Command Center, entity engine, and Dynatrace provisioning
are byte-for-byte the same code in both deployments — only the YAML differs.

## Demo Flow

1. **Presenter reskins** — picks (or authors with the kit) a `values-<industry>.yaml`.
2. **Presenter deploys** — `./scripts/deploy.sh install -f helm/values-custom.yaml -f helm/values-<industry>.yaml`.
3. **Presenter shows demo** — same demo flow (submit a request → show trace in Dynatrace), just in that industry's own vocabulary.

The demo flow is **identical** across industries. Only the config changes.

## Limitations

1. **No dynamic reskinning** — The reskin requires a redeploy. You can't change industries without redeploying.
2. **No runtime configuration** — The config is loaded at startup. You can't change it without redeploying.
3. **No A/B testing** — You can't run multiple industries simultaneously without multiple instances.

These are acceptable limitations for a demo platform. If you need dynamic reskinning, consider a production deployment with a configuration service.

## Future Enhancements

1. **Dynamic reskinning** — Load config from a service at runtime.
2. **Theme editor** — UI for editing themes without YAML.
3. **Component marketplace** — Shareable component libraries.
4. **Industry templates** — Pre-built industry configs for common use cases.
5. **Live hot-swap** — Architecture designed so live hot-swap is feasible later (see the archived [`INDUSTRY_PLATFORM_PLAN.md`](archive/INDUSTRY_PLATFORM_PLAN.md) §2, decision #2 — historical design doc, written before this platform existed).

## References

- **Authoring Kit (current, maintained reference):** `docs/authoring-kit/`
- **Authoring Prompt (LLM-assisted reskinning):** `docs/authoring-kit/AUTHORING_PROMPT.md`
- **Platform Design Plan (historical):** `docs/archive/INDUSTRY_PLATFORM_PLAN.md`
- **Audit Report (historical):** `docs/archive/Generic-Entity-Engine-Audit-Report.md`
- **Industry Config Schema:** `docs/industry-config.schema.json`
- **Working Agreement (API conventions):** `docs/API_CONVENTIONS.md`
- **Worked Examples (the only two that currently exist):**
  - `helm/values-airport.yaml` (Meridian International Airport)
  - `helm/values-nhvr.yaml` (National Heavy Vehicle Regulator)
- **Component Registry (public portal):** `frontends/public-portal/src/config/componentRegistry.jsx`
- **Page Composer (public portal):** `frontends/public-portal/src/components/PageComposer.jsx`
- **Configurable Components:**
  - `frontends/public-portal/src/components/WeatherWidget.jsx`
  - `frontends/public-portal/src/components/NewsTicker.jsx`
  - `frontends/public-portal/src/components/TransitPanel.jsx`
  - `frontends/public-portal/src/components/ChatWidget.jsx`
- **Entity Components:** `frontends/public-portal/src/components/entity/`
- **Ops Dashboard (not config-composable):** `frontends/ops-dashboard/src/pages/CommandCenter.jsx`, `frontends/ops-dashboard/src/pages/DemoControl.jsx`

# Meridian Platform — Industry Demo Authoring Prompt

> **How to use this file:** copy *everything below the line* into any capable LLM
> (ChatGPT, Claude, Gemini, Copilot…). Answer its questions about your industry. It
> will research the domain and output a ready-to-deploy `values-<industry>.yaml`.
> Save that file under `helm/` and deploy it (see the end of the prompt).
>
> This kit is LLM-agnostic — it's a plain prompt, no tool or plugin required. If your
> LLM has web search, it will use it to research the industry; if not, it falls back
> to its own knowledge.

---

You are helping a Dynatrace Sales Engineer re-skin **Meridian**, a fixed microservices
observability demo, for a specific industry. Meridian's front end (two React apps: a
customer **portal** and an **ops dashboard**), its back end (demo data + dispatch
routing), and its Dynatrace naming + business flows are **all driven by one declarative
YAML config**. Your job is to produce a complete, valid config for the SE's industry.

**Read this first — what you can and cannot do:**
- You are **not** writing code or inventing features. Meridian has a **fixed** set of
  screens and modules. You **compose and re-label** them for the target industry using
  configuration only.
- If a perfect industry-specific screen doesn't exist, **pick the closest generic one
  and relabel it** (e.g. "Service requests" → "Outage reports" for a utility).
- Some modules are **domain-specific** (aviation). Only use those for airport /
  transport / logistics demos. For everything else, use the **generic** modules.
- Never invent screen/module ids or config keys that aren't in the catalog below.

## Step 1 — Ask the SE (skip anything already provided)
1. **Industry / domain** (e.g. electric utility, hospital, retail bank, airport, telco).
2. **Company / brand name** shown to end users, plus a **short** name.
3. **Brand colors or a logo URL** (optional — infer tasteful, professional ones if not given).
4. Anything specific they want to **showcase**.

## Step 2 — Research the industry (before writing anything)
Work out, from research or domain knowledge:
- What end users are **called** (customer / citizen / passenger / patient / member / subscriber…).
- The common **service requests / issues** people report in that industry (for demo data).
- The **operational incidents** and physical **assets / equipment** that industry runs.
- The **departments** that handle those requests (for routing).
- Which Meridian **screens/modules genuinely fit**, and which to hide.
- A fitting, professional **brand palette** (hex colors).

## Step 3 — Compose the config using ONLY the catalog below

### Screens (per app). Entry is either `"<id>"` or `{ id: <id>, label: "Nav label" }`.
**Portal (`screens.public`):**
| id | What it is | Use for |
|----|-----------|---------|
| `home` | Landing page (its contents come from `home.public` modules) | always |
| `service-requests` | Submit + track requests/issues | generic — relabel per industry |
| `store` | Online store + orders | only if the industry sells goods |
| `billing` | Pay bills / fees | only if the industry bills customers |
| `messages` | Notifications inbox | generic |
| `my-journey` | Personal step-by-step journey tracker | aviation / transport only |

**Ops dashboard (`screens.ops`):**
| id | What it is | Use for |
|----|-----------|---------|
| `overview` | Ops landing (its contents come from `home.ops` modules) | always |
| `requests` | Request / work queue | generic — relabel |
| `incidents` | Operational incidents | generic — relabel |
| `iot` | Connected device / asset fleet | if the industry has sensors/equipment |
| `analytics` | Business analytics / KPIs | generic |
| `demo-control` | Demo control panel | **always keep** (SE controls) |
| `flight-board` | Live flight board | aviation only |
| `airfield` | Live airfield map with moving aircraft | aviation only |

### Home modules (per app), listed in `home.public` / `home.ops` (usually just ids).
**Portal (`home.public`):**
| id | What it is | Use for |
|----|-----------|---------|
| `city-home` | The default home bundle (local info + account summary) | **generic baseline home** |
| `quick-actions` | Quick-action tiles (auto-gated by active screens) | generic |
| `flight-status` | Compact departures/arrivals board | aviation |
| `airfield-map` | The airfield map | aviation |
| `my-journey` | Journey-tracker call-to-action | aviation / transport |

**Ops (`home.ops`):**
| id | What it is | Use for |
|----|-----------|---------|
| `ops-overview` | KPI row + requests-over-time chart | **generic baseline ops home** |
| `flight-summary` | Live flight KPI strip | aviation |

> For a **non-aviation** industry, use `home.public: ["city-home", "quick-actions"]`
> and `home.ops: ["ops-overview"]`. The aviation modules only make sense for
> airport-like demos.

### Terminology (all optional; each maps a generic noun to your industry's word)
`customer`, `customerPlural`, `request`, `requestPlural`, `incident`, `incidentPlural`,
`workOrder`, `asset`, `assetPlural`.

### Theme
`theme.colors`: `brand`, `brandDeep`, `brandSoft`, `brandTint`, `accent`, `accentSoft`,
`accentInk` — all hex. `theme.logo` (path/URL, `""` = built-in mark), `theme.favicon`.

### Company
`company.name`, `company.short`, `company.tagline`,
`company.assistant.name`, `company.assistant.persona`,
`company.assistant.supportPhone` (optional),
`company.assistant.systemPrompt` (optional multi-line — keeps the AI assistant in
character for the industry; see the airport example).

### Backend blocks (delivered to services, NOT shown in the browser)
- `data.zones`: list of area/location names for the industry.
- `data.requestTemplates`: list of `{ category, title, description }` — realistic issues
  people report. **`category` must match a key in `routing`.**
- `data.chatQuestions`: example questions end users might ask the assistant.
- `routing`: map of `category → "Department name"`. Keys are lowercase-hyphen slugs and
  must match the `data.requestTemplates` categories.
- `dynatrace.serviceNames`: map of k8s deployment → display name in the Dynatrace service
  map. Deployments you may rename: `citizen-service`, `service-dispatch`,
  `city-operations`, `api-gateway`, `notification-service`, `commerce-service`,
  `billing-service`, `demo-control-api`.
- `dynatrace.flowLabels`: map of business-flow key → Business Flow title. Keys:
  `service-request`, `account-creation`, `iot-incident`, `purchase`, `tax-payment`,
  `aircraft-turnaround`, `passenger-journey`.
- `dynatrace.flows`: list of flow keys to actually provision — **drop the ones the
  industry doesn't use** (e.g. omit `purchase`/`tax-payment` if there's no store/billing;
  only include `aircraft-turnaround`/`passenger-journey` for aviation).

## Rules (validate before you output)
1. Output **valid YAML**, 2-space indent, a single top-level `industry:` block.
2. Use keys **exactly** as catalogued (camelCase for multi-word: `brandDeep`,
   `requestTemplates`, `serviceNames`, `supportPhone`, `systemPrompt`).
3. Every screen/home-module **id must be from the catalog**. Don't invent ids.
4. `routing` keys must match the `category` values in `data.requestTemplates`.
5. Colors are hex (`#RGB` or `#RRGGBB`).
6. Keep end-user branding **real and consistent** — no placeholders/TODO.
7. **Hide what doesn't apply**: omit `store`/`billing` screens and the
   `purchase`/`tax-payment` flows for industries that don't sell or bill; omit the
   aviation screens/modules for non-transport industries.
8. `version: 1`; `id:` a short industry slug (e.g. `utilities`, `hospital`).

## Template (annotated skeleton — fill every value)
```yaml
industry:
  version: 1
  id: <slug>                       # short industry slug, e.g. "utilities"
  company:
    name: "<Brand Name>"           # shown to end users
    short: "<Short>"
    tagline: "<one-line tagline>"
    assistant:
      name: "<Assistant name>"
      persona: "<one line: who the assistant is>"
      supportPhone: "<optional phone>"
      systemPrompt: |-
        <optional multi-line system prompt that keeps the assistant in character
        for this industry — what it helps with, tone, when to escalate>
  theme:
    colors:
      brand: "#RRGGBB"             # primary brand color
      brandDeep: "#RRGGBB"         # darker shade
      brandSoft: "#RRGGBB"         # lighter shade
      brandTint: "#RRGGBB"         # very light background tint
      accent: "#RRGGBB"            # secondary/accent
      accentSoft: "#RRGGBB"
      accentInk: "#RRGGBB"         # dark text that reads on the accent
    logo: "/<logo>.svg"            # or "" for the built-in mark, or a URL
    favicon: "/<favicon>.svg"
  terminology:
    customer: "<Customer noun>"
    customerPlural: "<Customers>"
    request: "<Request noun>"
    requestPlural: "<Requests>"
    incident: "<Incident noun>"
    incidentPlural: "<Incidents>"
    workOrder: "<Work order noun>"
    asset: "<Asset noun>"
    assetPlural: "<Assets>"
  screens:                         # pick + relabel; drop what doesn't apply
    public:
      - home
      - { id: service-requests, label: "<Nav label>" }
      - messages
    ops:
      - overview
      - { id: requests, label: "<Nav label>" }
      - { id: incidents, label: "<Nav label>" }
      - { id: iot, label: "<Nav label>" }
      - { id: analytics, label: "<Nav label>" }
      - demo-control
  home:
    public: ["city-home", "quick-actions"]
    ops: ["ops-overview"]
  data:
    zones: ["<area 1>", "<area 2>", "..."]
    requestTemplates:
      - { category: <slug>, title: "<issue title>", description: "<realistic detail>" }
      # …10–15 realistic entries across a few categories
    chatQuestions:
      - "<a question a user would ask the assistant>"
      # …8–12 entries
  routing:
    <slug>: "<Department name>"     # one per category used above
  dynatrace:
    serviceNames:
      citizen-service: "<display name>"
      city-operations: "<display name>"
      service-dispatch: "<display name>"
      api-gateway: "<display name>"
      notification-service: "<display name>"
      # commerce-service / billing-service only if you kept store/billing
    flowLabels:
      service-request: "<flow title>"
      account-creation: "<flow title>"
      iot-incident: "<flow title>"
    flows:
      - service-request
      - account-creation
      - iot-incident
      # + purchase / tax-payment only if the industry sells/bills
```

## Worked example — Meridian Airport (condensed, for reference)
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
        flight status, gates, parking, security waits, lounges, and baggage; and with
        reporting/checking airport issues. Be concise, warm, and stay in character.
  theme:
    colors: { brand: "#0B3D91", brandDeep: "#072A63", brandSoft: "#2563EB",
              brandTint: "#E7EEFB", accent: "#06B6D4", accentSoft: "#38BDF8", accentInk: "#062B36" }
    logo: "/meridian-airport-logo.svg"
    favicon: "/meridian-airport-logo.svg"
  terminology:
    customer: "Passenger"
    customerPlural: "Passengers"
    incident: "Operational incident"
    incidentPlural: "Operational incidents"
    asset: "Ground equipment"
    assetPlural: "Ground equipment"
  screens:                          # store + billing omitted for the airport
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
    public: [flight-status, airfield-map, my-journey, quick-actions]
    ops: [flight-summary, ops-overview]
  data:
    zones: [terminal-1, terminal-2, concourse-a, airfield, baggage-hall, curbside]
    requestTemplates:
      - { category: airfield, title: "FOD debris on Taxiway C", description: "Foreign object debris near the B intersection." }
      - { category: baggage, title: "Carousel 4 jammed", description: "Bags backing up on belt 4 in the baggage hall." }
      - { category: security, title: "Lane 3 scanner error", description: "The X-ray scanner at security lane 3 keeps faulting." }
    chatQuestions:
      - "How long is the security wait at Terminal 1?"
      - "Which gate does my flight leave from?"
  routing:
    airfield: "Airfield Operations"
    baggage: "Baggage Handling"
    security: "Security & Screening"
  dynatrace:
    serviceNames:
      citizen-service: "Passenger Services"
      city-operations: "Airfield Operations"
      service-dispatch: "Operations Dispatch"
      api-gateway: "Airport API Gateway"
    flowLabels:
      service-request: "Maintenance Request Lifecycle"
      account-creation: "Passenger Registration"
      iot-incident: "Ground Equipment Incident Resolution"
    flows: [service-request, account-creation, iot-incident, aircraft-turnaround, passenger-journey]
```

## Output format
1. A single fenced ```yaml block containing the complete `values-<industry>.yaml`.
2. A short bullet **rationale** (why these screens/terms/flows fit the industry).
3. The **deploy command**:
   ```
   # save the YAML as helm/values-<industry>.yaml, then:
   ./scripts/deploy.sh install -f helm/values-custom.yaml -f helm/values-<industry>.yaml
   ```
   (Optionally sanity-check the render first — catches YAML/structure errors before deploy:
   `helm template meridian helm/ -f helm/values-custom.yaml -f helm/values-<industry>.yaml >/dev/null && echo OK`.)

Now begin at **Step 1** and ask the SE about their industry.

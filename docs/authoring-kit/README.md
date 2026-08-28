# Meridian Industry Authoring Kit

Generate a Meridian demo config for **any** industry by pasting one prompt into an LLM.

Meridian is a single app whose branding, terminology, screens, home/ops modules, demo
data, dispatch routing, and Dynatrace naming + business flows are all driven by one
`values-<industry>.yaml`. This kit hands an LLM the full catalog + template so it can
author that file for your industry -- no code required.

## Steps

1. Open [`AUTHORING_PROMPT.md`](./AUTHORING_PROMPT.md) and copy everything below the `---` line.
2. Paste it into any capable LLM (ChatGPT, Claude, Gemini, Copilot...).
3. Answer its questions (industry, brand name, colors, what to showcase).
4. It researches the domain and outputs a complete `values-<industry>.yaml`.
5. Save it as `helm/values-<industry>.yaml`.
6. (Optional) sanity-check the render:
   ```
   helm template meridian helm/ -f helm/values-custom.yaml -f helm/values-<industry>.yaml >/dev/null && echo OK
   ```
7. Deploy:
   ```
   ./scripts/deploy.sh install -f helm/values-custom.yaml -f helm/values-<industry>.yaml
   ```
   (`values-custom.yaml` holds your cluster/tenant secrets; the industry file only
   overrides the `industry:` block. Both are passed together -- Helm merges them.)

## What it can and can't do

### Can

- **Reskin** the entire application: brand colors, logo, favicon, tagline, and assistant
  persona -- all from the `theme` and `company` blocks.
- **Relabel** every screen, nav item, and UI noun: `customer` becomes `passenger`,
  `request` becomes `flight booking`, `incident` becomes `disruption`, etc.
- **Compose** the home page from a library of modules: generic baseline modules
  (`city-home`, `quick-actions`, `ops-overview`) plus industry-specific ones
  (aviation: `flight-status`, `airfield-map`, `my-journey`, `flight-summary`).
- **Configure home module content** without code changes:

  | Module ID | Config Fields | Example |
  |-----------|---------------|---------|
  | `weather` | `location` (string), `units` (`fahrenheit` or `celsius`) | `{ id: weather, location: "Meridian Airport", units: "fahrenheit" }` |
  | `news-ticker` | `headlines` (array of strings) | `{ id: news-ticker, headlines: ["Flight 123 On Time", "Gate B12 Closed"] }` |
  | `transit-map` | `routes` (array of `{name, stops[]}`) | `{ id: transit-map, routes: [{ name: "Shuttle 1", stops: ["Central", "Airport"] }] }` |
  | `chat-widget` | `assistantName` (string), `assistantPersona` (string) | `{ id: chat-widget, assistantName: "Bank Assistant", assistantPersona: "..." }` |

  These are configured via the `home.public` array in the industry config. The
  components read their content from the config instead of being hardcoded.
- **Define custom domain entities** with typed fields, lifecycle state machines, and
  entity templates (list, detail, map, analytics, journey pages auto-generated from
  the entity schema).
- **Generate** industry-realistic demo data (request templates, chat questions, zones)
  and dispatch routing (request category to department).
- **Rename** the Dynatrace service map names and business flows (and drop flows that
  don't apply to the industry).
- **Switch industries** by changing one YAML file and redeploying -- the same demo
  flow (e.g., "book a trip" / "open an account" / "buy tickets") runs identically
  in every industry, just with different labels and data.

### Can't

- Invent brand-new screen components or home modules -- those require code. The kit
  **composes and re-skins** Meridian's existing module library. The prompt's catalog
  lists everything available; generic templates (`entity-list`, `entity-map`,
  `status-map`, etc.) cover most domain objects without any code.
- Dynamically reskin at runtime -- the config is loaded at startup. Switching
  industries requires a redeploy.
- Add new entity field types beyond what the entity engine supports (string, number,
  date, enum, etc.).

## Configurable Components

The following home modules are now fully configurable via the industry YAML. They
were previously hardcoded and now read their content from the config, enabling zero-code
reskinning.

### Weather Widget

Displays a weather tile on the home page.

```yaml
home:
  public:
    - { id: weather, label: "Airport Weather", location: "Meridian Airport", units: "fahrenheit" }
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `location` | string | `company.name` | Location name shown in the widget |
| `units` | `'fahrenheit'` or `'celsius'` | `'fahrenheit'` | Temperature units |

### News Ticker

Scrolling headlines on the home page.

```yaml
home:
  public:
    - { id: news-ticker, label: "Flight Updates", headlines: ["Flight 123 On Time", "Gate B12 Closed"] }
```

| Field | Type | Default | Description |
|-------|------|---------|-----------|
| `headlines` | array of strings | `["Welcome to Meridian City", "Enjoy your stay"]` | Headline strings to display |

### Transit Map

Route/stops display for the home page.

```yaml
home:
  public:
    - { id: transit-map, label: "Shuttle Map", routes: [{ name: "Shuttle 1", stops: ["Central", "Airport"] }] }
```

| Field | Type | Default | Description |
|-------|------|---------|-----------|
| `routes` | array of `{name, stops[]}` | Hardcoded shuttle routes | Route objects with name and stop list |

### Chat Widget

Configures the AI assistant's name and persona on the home page.

```yaml
home:
  public:
    - { id: chat-widget, label: "Ask Assistant", assistantName: "Bank Assistant", assistantPersona: "Meridian Bank's virtual assistant" }
```

| Field | Type | Default | Description |
|-------|------|---------|-----------|
| `assistantName` | string | `company.assistant.name` or `"Meri"` | Assistant display name |
| `assistantPersona` | string | `company.assistant.persona` | One-line description of the assistant |

## Example: Full Home Page Config

Here is a complete `home:` block for a bank industry, combining all configurable
modules:

```yaml
home:
  public:
    - { id: city-home, label: "Welcome" }
    - { id: news-ticker, label: "Market Updates", headlines: ["S&P 500 Up 1.2%", "Federal Reserve Holds Rates"] }
    - { id: weather, label: "Local Weather", location: "Meridian Bank HQ", units: "fahrenheit" }
    - { id: chat-widget, label: "Ask Assistant" }
  ops:
    - { id: ops-overview, label: "Overview" }
    - { id: news-ticker, label: "System Alerts", headlines: ["API latency nominal", "All services healthy"] }
```

## Reference

- **Full catalog + template + rules:** [`AUTHORING_PROMPT.md`](./AUTHORING_PROMPT.md)
- **Worked examples:**
  - [`../../helm/values-airport.yaml`](../../helm/values-airport.yaml) (Meridian Airport)
  - [`../../helm/values-bank.yaml`](../../helm/values-bank.yaml) (Meridian Bank)
  - [`../../helm/values-baseball.yaml`](../../helm/values-baseball.yaml) (Meridian Baseball)
  - [`../../helm/values-hospital.yaml`](../../helm/values-hospital.yaml) (Meridian Hospital)
  - [`../../helm/values-powerutility.yaml`](../../helm/values-powerutility.yaml) (Power Utility)
- **Default (Meridian City):** the `industry:` block in [`../../helm/values.yaml`](../../helm/values.yaml)
- **Schema:** [`../industry-config.schema.json`](../industry-config.schema.json)
- **Platform design:** [`../INDUSTRY_PLATFORM_PLAN.md`](../INDUSTRY_PLATFORM_PLAN.md)

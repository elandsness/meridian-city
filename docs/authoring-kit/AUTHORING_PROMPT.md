# Meridian Platform — Semantic Industry Authoring Prompt

> **How to use this file:** copy *everything below the line* into any capable LLM
> (ChatGPT, Claude, Gemini…). Tell it which industry you want. It will research
> the domain, design the semantic signal chain, and output a complete `values-<industry>.yaml`.
> Save that file under `helm/` and deploy.

---

You are a **Semantic Architect** helping a Dynatrace Sales Engineer re-skin **Meridian**, a microservices observability demo platform. 

**THE CORE ARCHITECTURE:**
Meridian is now a **Semantic Signal Player**. The backend is a generic entity engine that knows nothing about industries. It simply executes state transitions and fires "signals" (structured logs). Dynatrace observes these signals to build Business Flows. 

Your job is to design a "Semantic Map" in a YAML config that tells the engine:
1. **What entities exist** (e.g., a "Claim", a "Patient", a "Shipment").
2. **How they move** (their lifecycle states and transitions).
3. **What signals to fire** (the exact log strings and correlation IDs) to make Dynatrace believe it is monitoring a real industry.

---

## Step 1 — Ask the SE (skip anything already provided)
1. **Industry / domain** (e.g. hospital network, shipping port, electric utility, retail bank).
2. **Company / brand name** and a **short name**.
3. **Brand colors** (hex) or a reference (logo, website).
4. Anything they specifically want to **showcase** (a particular flow, entity type, Dynatrace feature).

---

## Step 2 — Research & Semantic Design
Before writing YAML, you must research the industry to define the **Semantic Signal Chain**.
Search for:
- Key performance metrics (KPIs) and "Golden Signals" for this industry.
- The "Ideal Path" for a customer/asset (e.g., for a hospital: Triage $ightarrow$ Treatment $ightarrow$ Discharge).
- The "Error Paths" (where things typically fail/drop off).
- Industry-specific terminology (e.g., "Patient" in health, "Shipper" in logistics).

**DESIGN REQUIREMENT:** You must define a common **Unifying ID** for every flow (e.g., `claim_id`, `tracking_no`, `patient_id`). This ID must be used as the `correlationId` in every signal in that flow.

---

## Step 3 — Design your Entity Types (The Semantic Map)
You are designing a state machine. For every entity, you define its fields, its states, and most importantly, the **Signals** fired during transitions.

### ⚠️ THE OBSERVABILITY CONTRACT (MANDATORY)
To ensure Dynatrace Business Flows work, every transition MUST map to a specific semantic signal.
1. **Correlation ID:** Every signal must be tied to the entity's unifying ID (e.g., `passenger.id`).
2. **Event Names:** Use a `type.state` pattern (e.g., `passenger.boarded`).
3. **No Invention:** Do not invent arbitrary logs. The goal is to produce a signal stream that matches the "Gold Standard" for a business process.

### ⚠️ THE BASE CONFIG YOU ARE OVERLAYING (MANDATORY READING)

Your output YAML is NOT deployed alone. The platform always deploys its own
built-in "city" config underneath yours (standard Helm chart behavior: the
chart's default values are the base layer, your file is an overlay merged on
top — not a replacement). That base config already defines six entity types:
`citizen`, `service_request`, `bill`, `cart` (customer-facing) and `incident`,
`work_order` (ops-facing).

**If you don't explicitly remove the ones you're not using, they stay active
underneath your industry** — the backend will keep generating and tracking
real citizen signups, tax bills, and store orders for an industry that has
nothing to do with any of that, and every dashboard will show those
irrelevant flows mixed in with yours. This is not cosmetic — it is a real,
previously-shipped bug.

**Fix:** at the very top of your `entities:` block, explicitly delete every
one of those six you are not reusing by setting it to YAML `null` (the
standard idiom for removing a key from a merged map):

```yaml
entities:
  citizen: null
  bill: null
  cart: null
  incident: null
  work_order: null
  # (leave service_request out of this list if you intend to redefine it below —
  #  a full redefinition replaces it; only entities you want GONE need null)
```

Only skip nulling an entity if your industry is genuinely reusing it as-is or
redefining it with your own fields/states below.

### Entity type DSL
```yaml
entities:
  <entity_type_key>:               # snake_case (e.g. claim, container)
    displayName: "<Singular name>"
    displayNamePlural: "<Plural>"
    idPrefix: "<short prefix>"     # 2-6 lowercase letters (e.g. clm)
    domain: customer|ops           # MANDATORY -- see below, no default
    fields:
      <field_name>:                # snake_case (e.g. claim_number)
        type: string|number|boolean|date|enum|ref
        required: true|false
        default: <value>
        values: [...]              # enum type only
        entity: <other_type_key>   # ref type only
    initial: <state_key>           # must be a key in states
    states:
      <state_key>:                 # snake_case
        label: "<Human-readable label>"
        tone: slate|blue|amber|orange|green|red
        terminal: true             # final state
        isError: true              # error terminal state
        isKpi: true                # count this as a business KPI
        glyph: "<emoji>"
    transitions:
      - from: <state_key>
        to: <state_key>
        label: "<Action label>"
        userTriggerable: true|false
        timer: { minSeconds: 30, maxSeconds: 120 } # MUST be present for auto-advance
        when: { probability: 0.15 }                # probability of taking this branch
        signal:                            # THE SEMANTIC BRIDGE
          eventType: "<event.type>"       # e.g. "passenger.boarded"
          correlationId: "<field_key>"    # e.g. "passenger.id"
        effects:                           # Side effects (e.g. spawn linked entity)
          - { action: "spawnLinked", entityType: "...", fields: { ... } }
    computed:
      position: { type: point2d, interpolation: linear, waypoints: { <state>: {x: 1, "y": 2} } }
    generator: { strategy: simpleSteadyState, intervalMs: 20000, maxActive: 10 }
```

### ⚠️ CRITICAL GOTCHAS
1. **THE NORWAY PROBLEM:** Always quote `"y"` in waypoints (e.g., `"y": 280`). Unquoted `y` is read as boolean `true` and crashes the app.
2. **ID HYGIENE:** `idPrefix` must be `[a-z][a-z0-9]*` (no hyphens).
3. **AUTO-ADVANCE:** Every transition that is not `userTriggerable` MUST have a `timer` block, or the entity will stay stuck forever.
4. **RESERVED NAMES:** `work_order` and `journey` are reserved. Do not redefine them (you may still `null` out `work_order` if unused).
5. **CORRELATION:** Ensure the `correlationId` in the signal block exactly matches a field name defined in the `fields` block.
6. **`domain` IS MANDATORY, NOT OPTIONAL:** the backend runs as two separate
   deployments, one that only processes entities with `domain: customer`, one
   that only processes `domain: ops`. An entity with no `domain` is never
   picked up by either one — it will never be created or advanced, no matter
   how correctly everything else is written, and any screen for it will stay
   empty forever. There is no default; you must set it on every single entity
   you define. Customer-facing (something a customer/passenger/patient tracks
   or sees) → `customer`. Ops-facing (something the operations team manages)
   → `ops`.

---

## Step 4 — The Rest of the Config
Continue with the standard Meridian sections:
- **terminology**: Map generic nouns to industry nouns (e.g. `customer` $ightarrow$ `Patient`).
- **screens**: Compose the public portal's UI using the module catalog (`screens.public`).
  ops-dashboard is a fixed Command Center + Demo Control app — there's no `screens.ops`/
  `home.ops` to compose.
- **home**: Define the public portal's home layout. Lead it with a `template: ticker`
  module carrying 6-8 GENERATED, light/funny,
  industry-flavored headlines — a cheap, high-charm touch for almost any demo.
  Generate the tone and content yourself from the industry's own flavor (an
  airport's headlines read differently than a hospital's or a bank's); don't
  reuse another industry's items verbatim.
- **data**: Provide realistic seeds for zones and request templates.
- **routing**: Map request categories to departments (MUST include `other: "General Support"`).
- **dynatrace**: Map fixed platform service keys to industry labels and list the flows to enable.

---

## Step 5 — Validation Checklist
Before outputting, verify:
1. **Signal Completeness:** Does every transition have a `signal` block?
2. **Correlation Integrity:** Does every `correlationId` exist as a field in the entity?
3. **Timer Check:** Do all auto-transitions have timers?
4. **Y-Quoting:** Are all `"y"` keys quoted?
5. **Routing Sync:** Does every key in `routing` exist in `terminology.requestCategories`?
6. **Domain Completeness:** Does every entity you defined have a `domain: customer` or `domain: ops`?
7. **Base Entity Cleanup:** Is every one of `citizen`/`bill`/`cart`/`incident`/`work_order`
   that your industry does NOT reuse set to `null` at the top of `entities:`?

---

## Output format
1. A single fenced ```yaml block.
2. A **Semantic Rationale**: Explain the chosen Signal Chain and how it represents the industry's "Golden Path."
3. The **deploy command** (validate $ightarrow$ install).

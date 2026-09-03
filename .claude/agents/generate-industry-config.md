---
name: generate-industry-config
description: >
  Generate a deployment-ready Meridian industry config overlay (values-<industry>.yaml).
  Reads the authoring prompt, researches the domain, designs entity types, assembles the
  full YAML, runs the local validator in a loop until it passes, then writes the file.
  Use when a Sales Engineer wants to re-skin Meridian for a new industry.
tools:
  - Bash
  - Read
  - Write
  - Edit
  - WebSearch
  - WebFetch
---

# Meridian Industry Config Generator

You produce a deployment-ready `values-<industry>.yaml` for the Meridian platform.
Follow the steps below **in order**. Do not skip the validator loop.

---

## Step 0 — Load the authoritative source material

Read these two files before writing a single line of YAML:

1. `docs/authoring-kit/AUTHORING_PROMPT.md` — the full spec: DSL reference, screen/module
   catalog, validation checklist, and two worked examples.
2. `docs/industry-config.schema.json` — the AJV schema the validator enforces.

Everything in those files is authoritative. This skill adds **platform-specific rules that
the authoring prompt does not cover** — things discovered in production that LLMs consistently
miss. Both sources together form the complete rule set.

---

## Step 1 — Clarify requirements

Ask (or infer from context):
- Industry / domain
- Company name and short name
- Brand colors or a reference (infer professional ones if not given)
- Anything to specifically showcase (a flow, entity, Dynatrace feature)

If the user already provided all of this, skip to Step 2.

---

## Step 2 — Research the industry

Search the web before designing anything. Find:
- Day-to-day operations and key KPIs
- What end users need to do (the "citizen" analog)
- Operational departments and roles
- Physical assets / sensors the industry monitors
- Industry-specific vocabulary for service request, incident, work order
- 2–3 workflows that make compelling Dynatrace demos

The more authentic the domain knowledge, the more compelling the demo.

---

## Step 3 — Design entity types

Read Step 3 of `docs/authoring-kit/AUTHORING_PROMPT.md` for the full DSL.

**Additional platform rules not in the authoring prompt:**

### Rule P1 — ownedTypes overrides are mandatory for custom entities

The `industry:` block tells the frontend what exists. The entity engine only creates
and manages entities whose types are listed in `customerEntityService.ownedTypes` or
`opsEntityService.ownedTypes`. These are Helm values **outside** the `industry:` block.

For every custom entity type you define with a `generator`, you must add a top-level
override at the bottom of the YAML (after the `industry:` block closes):

```yaml
# Entity engine ownership — outside industry: block
customerEntityService:
  ownedTypes: "citizen,service_request,bill,cart,<your_customer_entity>"

opsEntityService:
  ownedTypes: "incident,work_order,<your_ops_entity>"
```

**Which service owns which entity:**
- `customerEntityService` — customer-facing entities (things a customer tracks/sees):
  concession orders, loan applications, patient admissions, outage events, meter readings
- `opsEntityService` — ops-facing entities (things the operations team manages):
  field repairs, gate assignments, crew jobs, maintenance tickets

**Always include the base types** in each list — never replace them, only extend:
- customerEntityService base: `citizen,service_request,bill,cart`
- opsEntityService base: `incident,work_order`

Without this override the entity engine never generates or transitions the custom entity —
the screen renders empty forever, and billing also breaks if the base types are omitted.

### Rule P2 — IoT terminology is required when the `iot` screen is active

If `iot` appears in `screens.ops`, you must add all six IoT terminology keys. Without them,
the IoT page and demo-control fleet panel fall back to the city defaults
("Vehicles / Buildings / Machines / veh / bldg / mach") regardless of industry:

```yaml
terminology:
  iotCategory1: "<Fleet type 1>"    # e.g. "Field Vehicles", "Ground Vehicles", "Service Vans"
  iotCategory2: "<Fleet type 2>"    # e.g. "Substations", "Equipment Rooms", "Branches"
  iotCategory3: "<Fleet type 3>"    # e.g. "Smart Meters", "POS Terminals", "Turnstiles"
  iotIdPrefix1: "<pfx>"             # 2–5 lowercase letters, no hyphens (e.g. "veh")
  iotIdPrefix2: "<pfx>"             # e.g. "sub", "rck", "eq"
  iotIdPrefix3: "<pfx>"             # e.g. "mtr", "pos", "scr"
```

Map to something that makes sense for the industry. Examples by vertical:

| Industry     | cat1             | cat2              | cat3           |
|-------------|-----------------|------------------|----------------|
| Utility      | Field Vehicles   | Substations       | Smart Meters   |
| Hospital     | Transport Units  | Patient Rooms     | Medical Devices|
| Baseball     | Vehicles         | Stadium Systems   | Scoreboards    |
| Bank         | ATM Network      | Branch Equipment  | Vault Systems  |
| Retail       | Delivery Vans    | Store Equipment   | POS Terminals  |

### Rule P3 — `iotZonePositions` is required when using `status-map` with `clusterBy: zone`

If the ops dashboard has a `status-map` screen with `clusterBy: zone`, the component reads
`terminology.iotZonePositions` to know where to cluster each device zone on the map.
Without it the map renders with zero sprites (no dots, "No data available").

Add this to terminology alongside the iotCategory fields:

```yaml
terminology:
  iotZonePositions:
    <zone-id>: { x: 400,  y: 300 }    # each key = a zone from data.zones
    <zone-id>: { x: 800,  y: 200 }    # coordinates in the status-map's viewBox space
    <zone-id>: { x: 1200, y: 500 }    # spread them across the viewBox — they become cluster centers
```

The `data.zones` list determines which zones exist. Every zone that should show on the map
needs an entry here. Zones with no position entry are silently skipped.

### Rule P4 — Always add `incidents` to ops when `iot` is present

The IoT page generates links to `/incidents` for any device-linked incident. If `incidents`
is not in `screens.ops`, those links 404 and redirect to the overview. Always pair `iot` with
`incidents` in the ops screen list, using an industry-appropriate label:

```yaml
screens:
  ops:
    - { id: incidents, label: "Grid Faults" }   # or "Clinical Incidents", "Equipment Alerts", etc.
    - { id: iot, label: "Asset Fleet" }
```

### Rule P5 — `work_order` is reserved — never redefine it

Defining `work_order` as a custom entity drops the incident-cascade chain. Any IoT anomaly
incident will never auto-resolve, leaving permanent warning dots on every device map.
Use domain-specific names: `field_order`, `crew_job`, `repair_task`, `maintenance_ticket`.

### Rule P6 — Fleet/moving-map entities use the reserved `journey` type, not a custom entity

If the industry has a fleet of things gliding between named locations (trucks between hubs,
vans between depots, ships between ports) — this is **not** a job for `computed.position.waypoints`
(that mechanism ties position to states, one waypoint per state, for things like a flight
progressing through gate → taxi → takeoff). A continuously-moving fleet vehicle needs
**journey-service**, a dedicated microservice with its own origin→destination interpolation.

Full details and a worked example are in `docs/authoring-kit/AUTHORING_PROMPT.md` Step 3b.
The essentials:

- `entityType` in the screen/home module must be **exactly `journey`** — the gateway only
  routes `/api/v1/entities/journey` to journey-service. Any other name 404s.
- `entities.journey.states` is for frontend rendering only (glyph/tone/label) and must use a
  subset of the fixed backend status names: `initiated`, `in_progress`, `completed`. These are
  global across the platform, not configurable per industry — an invented status name is never
  entered by the backend and its sprite will never appear.
- Do **not** add `computed.position` to `entities.journey` — it's ignored. Position comes from
  a required top-level `journeyService.generator.routes` block (outside `industry:`, a sibling of
  `customerEntityService`/`opsEntityService`):

  ```yaml
  journeyService:
    enabled: true   # OFF by default in the base chart -- required for any config
                     # using entityType: journey, or the fleet map is just empty.
    lifecycle: { minSeconds: 20, maxSeconds: 60 }   # default is 300-7200s (5min-2hr)
    generator:
      maxActive: 10
      entityTypes: ["truck"]              # cosmetic label only, not the routing key
      initialStatuses: { truck: "in_progress" }
      routes:
        - { origin: "Hub A", destination: "Hub B", originX: 180, originY: 200, destX: 210, destY: 290 }
  ```

- `journey` does **not** go in `customerEntityService`/`opsEntityService` `ownedTypes` (Rule P1
  doesn't apply — it's served by its own microservice, not the generic entity engine).
- No `journeyService.lifecycle.transitions` key exists — status progression is fixed in
  journey-service's own defaults, not exposed via Helm.
- Route lines are not auto-drawn. To make routes visible, add `line` shapes to the screen's
  `background: { kind: shapes, shapes: [...] }` at the same coordinates as each route.

---

## Step 4 — Assemble the YAML

Follow `docs/authoring-kit/AUTHORING_PROMPT.md` Step 4 (screens, home modules,
terminology, theme, company, data, routing, dynatrace).

Then apply the following pre-output checklist — these are the errors that survive
the authoring prompt but consistently fail the validator or break the live demo:

### Checklist A — Structure

- [ ] `routing:` is a **top-level key** inside `industry:`, at the same indentation as
      `terminology:`, `entities:`, `data:`, `dynatrace:`. Never nested inside `terminology:`.
- [ ] Every key in `routing` exists in `terminology.requestCategories`, and vice versa.
      This is bidirectional — a category with no routing entry causes a 500 on form submit.
- [ ] `other` is both in `requestCategories` and in `routing`.
- [ ] `version: 1` at the top of the `industry:` block.
- [ ] No invented top-level keys inside `industry:` (valid: `version`, `id`, `company`,
      `theme`, `terminology`, `screens`, `home`, `entities`, `data`, `routing`, `dynatrace`).

### Checklist B — Dynatrace

- [ ] `dynatrace.serviceNames` keys are **exactly** from this list — the left side is fixed:
      `citizen-service`, `city-operations`, `service-dispatch`, `api-gateway`,
      `notification-service`, `billing-service`. Invented keys are silently ignored.
- [ ] `dynatrace.flows` entries are **exactly** from:
      `service-request`, `account-creation`, `iot-incident`, `tax-payment`,
      `aircraft-turnaround`, `passenger-journey`. No invented ids.
- [ ] If `billing` is in `screens.public`, then `tax-payment` is in `dynatrace.flows`
      and `dynatrace.flowLabels` has an entry for it.
- [ ] `dynatrace.flowLabels` has an entry for every id listed in `dynatrace.flows`.

### Checklist C — Entities

- [ ] No `entity-journey` + `ownerField` in `screens.public` for custom entity types.
      The portal has no mechanism to create custom entities from user actions.
      Use `entity-list` (no `ownerField`) instead — shows the live pipeline.
- [ ] Every entity with a `generator` appears in at least one `screens` entry or `home` module.
- [ ] Every auto-advancing transition has a `timer`. A `when: { probability }` alone never fires.
- [ ] All `"y"` keys in `waypoints` are quoted: `"y": 280` not `y: 280`.
- [ ] `idPrefix` values match `[a-z][a-z0-9]*` — no hyphens.
- [ ] All state keys use `snake_case` — no hyphens.
- [ ] All state `tone` values are from: `slate`, `blue`, `amber`, `orange`, `green`, `red`.
- [ ] Every state referenced in `transitions` and `steps` exists in `states`.
- [ ] All states reachable from `initial` via at least one transition (or marked `externallyTriggered: true`).

### Checklist D — Platform supplements (Rules P1–P4 above)

- [ ] `customerEntityService.ownedTypes` override added outside `industry:` block, including
      base types plus every custom customer-facing entity that has a generator.
- [ ] `opsEntityService.ownedTypes` override added outside `industry:` block, including
      base types plus every custom ops-facing entity that has a generator.
- [ ] If `iot` in `screens.ops`: `iotCategory1/2/3` and `iotIdPrefix1/2/3` in `terminology`.
- [ ] If `status-map` with `clusterBy: zone`: `iotZonePositions` in `terminology`.
- [ ] If `iot` in `screens.ops`: `incidents` also in `screens.ops`.

### Checklist E' — Fleet / `journey` entities (Rule P6)

- [ ] Any fleet/moving-map screen or home module uses `entityType: journey` — never a custom name.
- [ ] `entities.journey.states` keys are a subset of `initiated`, `in_progress`, `completed`.
- [ ] `entities.journey` has no `computed.position` block.
- [ ] A top-level `journeyService` block exists (outside `industry:`) with `enabled: true`
      plus a `generator` with `entityTypes`, `initialStatuses`, and a non-empty `routes` list.
      journey-service is OFF by default — omitting `enabled: true` means the pod never runs.
- [ ] `journey` is NOT added to `customerEntityService`/`opsEntityService` `ownedTypes`.
- [ ] If routes should be visible, matching `line` shapes are added to `background.shapes`.

### Checklist E — Images

- [ ] `theme.heroImage`, `theme.logo`, `theme.favicon` (when set) use direct-download URLs
      or local paths. No Google Drive, Dropbox, or invented `raw.githubusercontent.com` paths.
- [ ] When uncertain, omit `theme.logo` and `theme.favicon` — the built-in Meridian mark
      recolored to `brand` looks correct; a 404 looks broken.

---

## Step 5 — Write, validate, iterate

1. Write the complete YAML to `helm/values-<industry>.yaml`.

2. Run the validator:
   ```bash
   node scripts/validate-industry-config.mjs helm/values-<industry>.yaml
   ```

3. If the validator reports errors, read each one carefully and fix the root cause in the
   file. Common patterns:
   - `routing key '<x>' not in requestCategories` → add `<x>` to `requestCategories` or
     change the routing key to match an existing category
   - `requestCategory '<x>' has no routing entry` → add the category to `routing`
   - `entity-journey + ownerField` → change `template: entity-list`, remove `ownerField`
   - `invalid serviceNames key` → replace with the correct fixed key
   - `invalid flows id` → replace with the closest valid id from the known list
   - `entity <x> has generator but no screen` → add an `entity-list` screen, or remove the generator
   - `billing screen active but tax-payment not in flows` → add `tax-payment` to `dynatrace.flows`

4. Re-run the validator. Repeat until you see:
   ```
   ✓ helm/values-<industry>.yaml: valid industry config (<Company Name>)
   ```

5. Never report success until the validator passes with zero errors.

---

## Step 6 — Output

After the validator passes, print:
1. The deploy command:
   ```
   ./scripts/deploy.sh install -f helm/values-custom.yaml -f helm/values-<industry>.yaml
   ```
2. A 3–5 bullet rationale: why these entity types, screens, and flows were chosen.
3. Any manual steps needed (e.g. committing custom SVG assets to `frontends/public-portal/public/`
   before triggering CI if using custom logo/favicon).

---

## Quick reference — LLM failure patterns and their fixes

These are the mistakes that appeared most frequently across Google Gemini, local models,
and Claude itself when generating industry configs. Read this list before writing any YAML.

| Mistake | Correct approach |
|---------|-----------------|
| `routing:` nested inside `terminology:` | `routing:` is a sibling of `terminology:`, not a child |
| Missing `other` in `routing:` | Always add `other: "General Support"` or equivalent |
| `entity-journey + ownerField` in `screens.public` | Replace with `entity-list` (no `ownerField`) |
| Invented `serviceNames` keys (`grid-operations`, `field-service`, `customer-entity-service`) | Use only the six fixed keys |
| Invented `flows` ids (`grid-fault-resolution`, `flight_departure`, `patient-care`) | Map to the 6 valid ids |
| `dynatrace.flows` missing `tax-payment` when billing screen is active | Add it + a `flowLabels` entry |
| Entity with generator but no screen | Add `entity-list` screen, or remove the generator |
| Transition with only `when: { probability }`, no `timer` | Add `timer:` — `when` is a filter, not a trigger |
| Unquoted `y:` in waypoints | Always write `"y": 280` |
| Custom entity not in `ownedTypes` | Add `customerEntityService` / `opsEntityService` override outside `industry:` |
| `iot` screen without matching `incidents` screen | Add `{ id: incidents, label: "..." }` to `screens.ops` |
| `status-map clusterBy: zone` with no `iotZonePositions` | Add `iotZonePositions` to terminology with zone → {x,y} centers |
| Missing `iotCategory1/2/3` + `iotIdPrefix1/2/3` | Add all six keys to terminology when `iot` screen is active |
| `billing` screen without `billingTitle/Subtitle/billNoun` | Always include all three when billing is active |
| Fabricated image URLs | Unsplash URLs or omit — never invent GitHub raw paths |
| `analytics:` block with invented flow ids | `analytics.flows` is browser-visible but same valid-id constraint applies |
| Claiming validator passes without running it | Always run and show the output |
| Fleet/moving-map entity given a custom `entityType` (e.g. `truck`) | Must be `entityType: journey` — only that name is routed to journey-service |
| Inventing `journey` status names (`loading`, `customs`, `delivered`) | Only `initiated`/`in_progress`/`completed` exist — fixed globally, not per-industry |
| `computed.position` added to `entities.journey` | Ignored — position comes from `journeyService.generator.routes`, not waypoints |
| Fleet map defined with no top-level `journeyService.generator.routes` | Map renders empty (or shows flights/passengers) — the block is required, outside `industry:` |
| Fleet map defined without `journeyService.enabled: true` | journey-service is OFF by default in the base chart — the pod never even runs |
| `journey` added to `customerEntityService`/`opsEntityService` `ownedTypes` | Wrong — journey-service is a separate microservice, not the generic entity engine |

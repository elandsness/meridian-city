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

### Rule P1 — every entity needs a `domain` so the owning deployment picks it up

The entity engine runs as two deployments against the same entity-config:
`customerEntityService` (Helm value `serviceRole: "customer"`) and `opsEntityService`
(`serviceRole: "ops"`). Each only generates/transitions the entities whose `domain`
(inside `industry.entities.<type>`) case-insensitively matches its own `serviceRole`.
An entity with no `domain` is never picked up by either deployment — it still renders
in a screen if you add one, but it never gets created or advanced, so the screen stays
empty forever.

For **every** entity type you define — base types and custom ones — set `domain` right
after `idPrefix`:

```yaml
industry:
  entities:
    <your_customer_entity>:
      displayName: "..."
      idPrefix: "..."
      domain: "customer"   # owned by customerEntityService
      ...
    <your_ops_entity>:
      displayName: "..."
      idPrefix: "..."
      domain: "ops"        # owned by opsEntityService
      ...
```

**Which domain owns which entity:**
- `domain: "customer"` — customer-facing entities (things a customer tracks/sees):
  concession orders, loan applications, patient admissions, outage events, meter readings
- `domain: "ops"` — ops-facing entities (things the operations team manages):
  field repairs, gate assignments, crew jobs, maintenance tickets

**The base city types already have `domain` set** (`citizen`/`service_request`/
`bill`/`cart` → customer, `incident`/`work_order` → ops) in the chart's own
`values.yaml` — you only need to set `domain` on types *you* define. But per
Rule P8 below, you almost always want to `null` out the base types you don't
reuse rather than leave them active with their city `domain`.

Omitting `domain` on any entity type you DO keep (base or custom) silently
drops it from both deployments' scheduler/generator.

### Rule P8 — null out every base city entity your industry doesn't use

The chart's own `values.yaml` is always the base layer underneath your overlay
(standard Helm behavior) — it already defines `citizen`, `service_request`,
`bill`, `cart`, `incident`, `work_order`. Your `values-<industry>.yaml` adding
its own entities does **not** replace that base map, it merges with it. Leave
even one of those keys un-nulled and your industry silently runs the city's
entity model alongside your own: entity-engine generates/tracks real citizen
signups, tax bills, and store orders for an industry that has nothing to do
with any of that, and the ops Command Center shows those irrelevant flows too.

For every base entity your industry isn't reusing, set it to `null` (the
standard Helm idiom for "delete this key from the merged map") at the top of
your `entities:` block:

```yaml
industry:
  entities:
    citizen: null
    bill: null
    cart: null
    incident: null
    work_order: null
    # ... then your industry's own entities below
```

**If you DO want an entity like one of the base ones, give it its own new
key — do not redefine a base entity's key in place.** Confirmed live: Helm
deep-merges YAML *maps* key-by-key at every nesting level, so redefining
e.g. `service_request` with your own `fields`/`states`/`generator` does
**not** replace the city's version, it merges on top of it — you silently
inherit the city's own leftover fields (`citizen_id`, `category`, `priority`,
`title`, `zone_id`, …) and orphaned states (`abandoned`, `submitted`,
`validated`, `rejected`, …) mixed into your entity. (`values-airport.yaml`
did this for `service_request` for a long time before this was caught —
it's now fixed there too, by renaming to `passenger_request` and nulling
`service_request` like every other base entity.) So: for a retail industry
wanting something cart-like, don't redefine `cart` — null it, and define
your own `shopping_cart` (or similar) as a brand-new entity key instead.

**Verify, don't assume**: the local validator (Step 5) reads your overlay file
in isolation, so it can't catch a city entity you forgot to null — it never
sees the merge. Confirm with the real Helm-rendered output instead:

```bash
helm template meridian helm/ -f helm/values-custom.yaml -f helm/values-<industry>.yaml \
  --show-only templates/entity-config-configmap.yaml \
  | python3 -c "import sys,yaml,json; print(sorted(json.loads(yaml.safe_load(sys.stdin)['data']['entity-config.json']).keys()))"
```

(`-f helm/values-custom.yaml` is required — several chart values it supplies,
like `appImageRegistry`, have no default, and the template render fails
without it.)

Every key printed should be one your industry actually uses.

### Rule P2 — device/asset fleet labels come from `industry.iot.deviceTypes`, not `terminology`

**Correction:** earlier versions of this file described a `terminology.iotCategory1/2/3` +
`iotIdPrefix1/2/3` mechanism for Demo Control's fleet panel labels. Checked live against
the current code (`services/demo-control-api/src/routes/fleet.js`,
`frontends/ops-dashboard/src/config/defaults.js`): those six keys are not read
*anywhere* in the codebase — the only occurrence of `iotCategory1` in the whole repo
is a stale comment. **This was never a real mechanism; don't add these keys.**

The actual, live mechanism: `fleet.js` builds each fleet card directly from
`industry.iot.deviceTypes[]`, using **that entry's own `displayName`** (falling
back to its bare `type` if `displayName` is absent) — nothing else to set:

```yaml
iot:
  enabled: true
  deviceTypes:
    - type: "vehicle"           # also used as the id prefix for generated devices
      displayName: "Field Vehicle"   # this IS the fleet panel's label — set it per type
      count: 30
      ...
    - type: "substation"
      displayName: "Substation"
      count: 10
      ...
```

If the industry has a device/asset fleet at all, just give every entry in
`iot.deviceTypes` a `displayName` that fits the industry — there is no
separate terminology block to populate.

### Rule P3 — `iotZonePositions` is required when using `status-map` with `clusterBy: zone`

If `screens.public` has a `status-map` screen with `clusterBy: zone`, the component reads
`terminology.iotZonePositions` to know where to cluster each device zone on the map.
Without it the map renders with zero sprites (no dots, "No data available").

Add this to terminology:

```yaml
terminology:
  iotZonePositions:
    <zone-id>: { x: 400,  y: 300 }    # each key = a zone from data.zones
    <zone-id>: { x: 800,  y: 200 }    # coordinates in the status-map's viewBox space
    <zone-id>: { x: 1200, y: 500 }    # spread them across the viewBox — they become cluster centers
```

The `data.zones` list determines which zones exist. Every zone that should show on the map
needs an entry here. Zones with no position entry are silently skipped.

### Rule P5 — `work_order` is reserved — never redefine it

Defining `work_order` as a custom entity drops the incident-cascade chain. Any IoT anomaly
incident will never auto-resolve, leaving permanent warning dots on every device map.
Use domain-specific names: `field_order`, `crew_job`, `repair_task`, `maintenance_ticket`.

### Rule P7 — Lead the public home with a generated flavor ticker

Add a `template: ticker` module as the FIRST entry in `screens.home.public` (or
`home.public`, matching whichever section the rest of the config uses), carrying
6-8 headlines you generate yourself for this specific industry — light, funny,
cute, plausible-sounding local buzz (not real news, not corporate announcements).
City's own example (`helm/values.yaml`'s `cityband` module) uses a more serious
civic-announcement tone; lean funnier/cuter unless the SE asks for something more
buttoned-up. Match the industry's own flavor — an airport's headlines should not
read like a hospital's or a bank's.

```yaml
- id: "<short-industry-id>band"       # e.g. "airportband", "bankband"
  template: "ticker"
  height: "slim"
  label: "<emoji> <SHORT ALL-CAPS LABEL>"   # e.g. "✈️ TERMINAL BUZZ"
  items:
    - "<generated headline 1>"
    - "<generated headline 2>"
    # ... 6-8 total
```

`Ticker.jsx` is fully generic (no industry assumptions in the component) and
auto-paces its scroll speed to the combined item text length, so any number/length
of items reads at a comfortable, consistent speed — don't worry about tuning speed.

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

- `entities.journey` does **not** need a `domain` (Rule P1 doesn't apply — it's served by
  its own microservice, not the generic entity engine).
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

- [ ] `dynatrace.serviceNames` keys are **exactly** from this list — the left side is fixed
      to the current generic services (not the pre-semantic-engine city services):
      `customer-entity-service`, `ops-entity-service`, `identity-service`, `journey-service`,
      `movement-service`, `routing-service`, `workflow-service`, `api-gateway`,
      `notification-service`, `billing-service`. Invented keys are silently ignored.
- [ ] `dynatrace.flows` entries are plain strings, each the exact key of an entity type
      declared in `industry.entities` with `states`/`initial` — the provisioner derives
      a flow for it automatically, with steps named `<entity_type>.<state>`. There is no
      more hardcoded legacy-id list (`service-request`/`aircraft-turnaround`/etc. were
      removed from the provisioner entirely — confirmed live:
      `helm/files/provision-dynatrace-business-config.py`'s `FLOW_SPECS`/`DEFAULT_FLOW_KEYS`
      are both now `[]`). Any string that isn't a real entity type key is silently ignored.
- [ ] If `billing` is in `screens.public` and you're keeping a bill-like entity
      (under its own key, not a `bill` redefinition — see Rule P8), that
      entity's key is in `dynatrace.flows` with a matching `dynatrace.flowLabels`
      entry. (`tax-payment` is **not** a valid flow id anymore — it was one of
      the legacy ids removed from the provisioner; see Checklist B.)
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

### Checklist D' — Flavor ticker (Rule P7)

- [ ] A `template: ticker` module is the first entry in the public `home.public` list.
- [ ] It has 6-8 generated, industry-flavored, light/funny headlines — not copied
      from another industry's config, not generic placeholder text.

### Checklist D — Platform supplements (Rules P1–P3, P8 above)

- [ ] Every entity in `industry.entities` has a `domain` of `"customer"` or `"ops"` —
      including any base types (`citizen`/`service_request`/`bill`/`cart` → customer,
      `incident`/`work_order` → ops) you kept.
- [ ] `entities.journey` (if present) has no `domain` — not owned by the entity engine.
- [ ] Every base city entity (`citizen`/`service_request`/`bill`/`cart`/`incident`/`work_order`)
      your industry does NOT reuse **completely as-is** is set to `null` in `entities:`
      (this includes `service_request` if you're defining your own version under a new
      key — see Rule P8). Confirmed with the `helm template` command in Rule P8, not
      just by eyeballing the overlay file.
- [ ] If the industry has a device/asset fleet: every `industry.iot.deviceTypes[]` entry
      has its own `displayName` set (not `terminology.iotCategory1/2/3`, which isn't real).
- [ ] If `status-map` with `clusterBy: zone`: `iotZonePositions` in `terminology`.

### Checklist E' — Fleet / `journey` entities (Rule P6)

- [ ] Any fleet/moving-map screen or home module uses `entityType: journey` — never a custom name.
- [ ] `entities.journey.states` keys are a subset of `initiated`, `in_progress`, `completed`.
- [ ] `entities.journey` has no `computed.position` block.
- [ ] A top-level `journeyService` block exists (outside `industry:`) with `enabled: true`
      plus a `generator` with `entityTypes`, `initialStatuses`, and a non-empty `routes` list.
      journey-service is OFF by default — omitting `enabled: true` means the pod never runs.
- [ ] `entities.journey` has no `domain` set.
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
   file. Common patterns (exact wording the validator prints, as of its current
   implementation in `scripts/validate-industry-config.mjs`):
   - `missing routing key for <x>` → add `<x>` to `routing`, or remove it from
     `terminology.requestCategories`
   - `invalid service name <x>` → replace with one of the fixed keys (Checklist B)
   - `invalid flow id <x>` → `<x>` must be the exact key of an `industry.entities`
     type that has `states` + `initial` — there is no other valid form anymore
   - `entities.<type>.computed.position.waypoints.<state> must be an array of points`
     → wrap the point in `[...]`, even for a single point
   - `entities.<type>.fields.<field> is required but has no default, no
     generator.fields.<field> hint, and no effect sets it` → add a
     `generator.fields.<field>` hint (or a `default`, or confirm some effect
     really does set it)
   - `entities.<type>...effects[...].fields.<field> is the literal string "<field>"`
     → you meant `{ from: "<field>" }`, not a bare string
   - `entities.service_request is redefined (non-null)` → give your entity a new
     key instead and null `service_request` (Rule P8)
   - any `/<path> must ...` message (no leading entity/field name) is a raw
     AJV schema error — check it against `docs/industry-config.schema.json`
     directly if the message alone isn't clear

4. Re-run the validator. Repeat until every file prints:
   ```
   ✓ helm/values-<industry>.yaml valid
   ```
   (that is the validator's actual, exact success line — it does not print the
   company name or the words "industry config").

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
| Invented `serviceNames` keys (`grid-operations`, `field-service`) | Use only the ten fixed keys (Checklist B) — note `customer-entity-service`/`ops-entity-service`/etc. ARE valid, they're the current real service names |
| Invented `flows` ids, or using an old legacy id (`service-request`, `tax-payment`, `aircraft-turnaround`, ...) | The legacy ids were removed entirely — every `dynatrace.flows` entry must be the exact key of a real `industry.entities` type with `states`/`initial` |
| `dynatrace.flows` missing an entry for a bill-like entity when a billing screen is active | Add that entity's own key (not `tax-payment`, which no longer works) + a matching `flowLabels` entry |
| Entity with generator but no screen | Add `entity-list` screen, or remove the generator |
| Transition with only `when: { probability }`, no `timer` | Add `timer:` — `when` is a filter, not a trigger |
| Unquoted `y:` in waypoints | Always write `"y": 280` |
| Entity missing `domain` | Add `domain: "customer"` or `domain: "ops"` right after `idPrefix` — including base types |
| City's `citizen`/`bill`/`cart`/`incident`/`work_order` left active in a non-city industry | `null` out every one you don't reuse — the chart's base `values.yaml` merges in underneath your overlay, it doesn't get replaced |
| `status-map clusterBy: zone` with no `iotZonePositions` | Add `iotZonePositions` to terminology with zone → {x,y} centers |
| Adding `terminology.iotCategory1/2/3` / `iotIdPrefix1/2/3` | **Don't** — this isn't a real mechanism (confirmed: nothing in the codebase reads these keys). Set `displayName` directly on each `industry.iot.deviceTypes[]` entry instead |
| `billing` screen without `billingTitle/Subtitle/billNoun` | Always include all three when billing is active |
| Fabricated image URLs | Unsplash URLs or omit — never invent GitHub raw paths |
| `analytics.flows`/`flowLabels` left as the city defaults, or omitted | Not validator-enforced (no check exists for this key), but mirror whatever entity-type keys you put in `dynatrace.flows` here too — this block isn't unified with `dynatrace.flows` yet and drifts silently otherwise |
| Claiming validator passes without running it | Always run and show the output |
| `computed.position.waypoints.<state>` as a bare `{x, "y"}` object | Must be a list, even for one point: `[{x, "y"}]` — a bare object crashes the backend on startup |
| A required field generated with no `default` and no `generator.fields.<field>` hint | Add a `generator.fields` entry (needed even for `enum` fields with their own `values:`) — otherwise it's `null` on every record, forever |
| `effects[].fields.<x>: "<x>"` expecting it to copy the entity's own field | A plain string is always a literal — use `{ from: "<x>" }` to copy a value |
| Fleet/moving-map entity given a custom `entityType` (e.g. `truck`) | Must be `entityType: journey` — only that name is routed to journey-service |
| Inventing `journey` status names (`loading`, `customs`, `delivered`) | Only `initiated`/`in_progress`/`completed` exist — fixed globally, not per-industry |
| `computed.position` added to `entities.journey` | Ignored — position comes from `journeyService.generator.routes`, not waypoints |
| Fleet map defined with no top-level `journeyService.generator.routes` | Map renders empty (or shows flights/passengers) — the block is required, outside `industry:` |
| Fleet map defined without `journeyService.enabled: true` | journey-service is OFF by default in the base chart — the pod never even runs |
| `domain` set on `entities.journey` | Wrong — journey-service is a separate microservice, not the generic entity engine |

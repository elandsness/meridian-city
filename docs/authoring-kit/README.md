# Meridian Industry Authoring Kit

Generate a Meridian demo config for **any** industry — no code required.

Meridian is a single semantic demo platform whose branding, terminology, screens,
entity types, state machines, demo data, dispatch routing, and Dynatrace naming +
Business Flows are all driven by one `values-<industry>.yaml` file layered on top
of the chart's base config. This kit gives an LLM everything it needs to author
that file for your industry.

There are two ways to use the kit — pick the one that fits your setup:

---

## ⚠️ Config compatibility — read this if you have an existing `values-<industry>.yaml`

The platform went through a major rewrite (the "semantic engine" rework) that
replaced the old fixed-city backend (`citizen-service` / `service-dispatch` /
`city-operations`, with per-type Postgres tables) with a **generic, config-driven
entity engine**: one polymorphic `entities.entity` table, state machines defined
entirely in YAML, and Dynatrace Business Flows *derived automatically* from those
state machines instead of a hardcoded flow list.

**A config file authored before this rewrite will not deploy correctly, and may
not validate at all.** The schema itself is versioned (`industry.version: 1`) to
make this explicit. If your overlay predates this change, expect some or all of:

- `dynatrace.flows` entries that reference old hardcoded flow ids (`service-request`,
  `tax-payment`, `aircraft-turnaround`, ...) — **removed entirely**. A flow id must
  now be the exact key of an `industry.entities` type that has `states` + `initial`.
- `dynatrace.serviceNames` keys for services that no longer exist (`citizen-service`,
  `service-dispatch`, `city-operations`, `commerce-service`, `billing-service`) —
  the current fixed key list is in [`AUTHORING_PROMPT.md`](./AUTHORING_PROMPT.md)
  and [`../industry-config.schema.json`](../industry-config.schema.json).
- Entity types with no `domain: "customer" | "ops"` — every entity now needs one,
  or neither half of the entity engine ever picks it up and its screen stays
  empty forever (Rule P1 below).
- A fleet/moving-map entity defined as a custom `entityType` instead of the
  reserved `entityType: journey` — the old per-industry moving-fleet mechanism
  is gone; it's now a dedicated `journey-service` (Rule P6 below).
- `terminology.iotCategory1/2/3` / `iotIdPrefix1/2/3` keys — never actually read by
  any code; safe to delete.

**Fix:** regenerate the config with the current authoring kit (Option A or B
below) rather than hand-patching an old file — the entity model changed enough
that a line-by-line patch is more work than a fresh generation. Use your old
file's `company`/`theme`/`terminology`/entity list as the brief you feed the
kit. Then validate:

```bash
node scripts/validate-industry-config.mjs helm/values-<industry>.yaml
```

The schema contract is [`../industry-config.schema.json`](../industry-config.schema.json);
the full authoring reference is [`AUTHORING_PROMPT.md`](./AUTHORING_PROMPT.md).

---

## Option A — Claude Code skill (recommended)

If you're working in this repo with [Claude Code](https://claude.ai/code), a purpose-built
agent handles the full workflow: research → design → generate → **validate → fix → repeat**
until the config passes the local validator. It writes the file, runs
`scripts/validate-industry-config.mjs`, and iterates automatically. You don't need to
manually copy prompts, paste YAML, or debug validator errors.

### Invoke the skill

In Claude Code, type:

```
/generate-industry-config
```

Claude will ask for the industry, company name, brand colors, and anything specific you
want to showcase. It then researches the domain, produces the full YAML, validates it in a
loop, and writes the final file to `helm/values-<industry>.yaml`.

### What the skill adds beyond the authoring prompt

The skill (defined in
[`.claude/agents/generate-industry-config.md`](../../.claude/agents/generate-industry-config.md))
wraps `AUTHORING_PROMPT.md` with platform rules the prompt doesn't cover — gaps
discovered from production deployments:

| Rule | What it enforces |
|------|-----------------|
| **P1 — entity `domain`** | Every entity in `industry.entities` you keep active needs `domain: "customer"` or `domain: "ops"`. The entity engine runs as two deployments — `customer-entity-service` and `ops-entity-service` — sharing the same config; each only generates/transitions entities whose `domain` matches its own role. No `domain` → neither deployment ever picks the entity up, and any screen for it stays empty forever. |
| **P2 — IoT fleet labels** | There is **no** `terminology.iotCategory1/2/3` / `iotIdPrefix1/2/3` mechanism — those keys are never read by any code. Fleet-panel labels come straight from each entry's own `displayName` in `industry.iot.deviceTypes[]`. |
| **P3 — `iotZonePositions`** | When a `status-map` screen uses `clusterBy: zone`, `terminology.iotZonePositions` must map each zone id to an `{x, y}` cluster center in the map's viewBox. Without it, no dots render. |
| **P5 — `work_order` is reserved** | Never redefine `work_order` as a custom entity — it drives the IoT-anomaly→incident auto-resolve chain. Use `field_order`, `crew_job`, `repair_task`, or similar instead. |
| **P6 — fleets use `entityType: journey`** | A continuously-moving fleet (trucks between hubs, ships between ports) is not a custom entity with `computed.position.waypoints` — that mechanism is for state-tied positions (a flight progressing gate → taxi → takeoff). A moving fleet needs the reserved `entityType: journey`, served by a dedicated `journey-service` (off by default — needs `journeyService.enabled: true` plus a `generator.routes` block, outside `industry:`). |
| **P7 — lead with a flavor ticker** | The first module in `home.public` should be a `template: ticker` block with 6–8 generated, industry-flavored headlines — light and plausible-sounding local buzz, in that industry's own voice. |
| **P8 — null out unused base entities** | The chart's `values.yaml` (the "Meridian City" default) is always the base layer under your overlay — it isn't replaced, it's merged with. `null` out every one of `citizen`/`service_request`/`bill`/`cart`/`incident`/`work_order` your industry doesn't reuse **as-is**, or the entity engine keeps generating/tracking real city data (citizen signups, tax bills, store orders) underneath your industry, and the ops Command Center shows those irrelevant flows too. If you want something cart-like, give it a brand-new key — redefining a base entity's key *merges* onto it rather than replacing it. |

The skill also maintains a quick-reference table of the most common LLM generation
mistakes (fabricated `serviceNames` keys, invalid `flows` ids, `routing:` nested inside
`terminology:`, `entity-journey + ownerField` on custom entities, inventing `journey`
status names, etc.) and checks all of them before running the validator.

### After the skill finishes

1. The file is already written. Run CI by pushing the branch or triggering a workflow dispatch.
2. If you want a custom logo, you usually don't need to do anything — for any
   non-`city` industry, a branding job auto-generates an on-brand logo from
   `theme.colors.brand` + `company.name` at deploy time. Only commit a real asset
   to `frontends/public-portal/public/` (and reference it from `theme.logo`/`favicon`
   by URL) if the SE supplied one.
3. Deploy:
   ```
   ./scripts/deploy.sh install -f helm/values-custom.yaml -f helm/values-<industry>.yaml
   ```

---

## Option B — Manual prompt (any LLM, no Claude Code)

Use this if you're working outside Claude Code or want to collaborate with ChatGPT,
Gemini, or another assistant.

1. Open [`AUTHORING_PROMPT.md`](./AUTHORING_PROMPT.md) and copy everything below the `---` line.
2. Paste it into any capable LLM (ChatGPT, Claude, Gemini, Copilot...).
3. Answer its questions (industry, brand name, colors, what to showcase).
4. It researches the domain and outputs a complete `values-<industry>.yaml`.
5. Save it as `helm/values-<industry>.yaml`.
6. **Validate before deploying** — the validator catches most LLM mistakes:
   ```
   node scripts/validate-industry-config.mjs helm/values-<industry>.yaml
   ```
   Fix any errors it reports and re-run until clean.
7. (Optional) sanity-check the Helm render:
   ```
   helm template meridian helm/ -f helm/values-custom.yaml -f helm/values-<industry>.yaml >/dev/null && echo OK
   ```
8. Deploy:
   ```
   ./scripts/deploy.sh install -f helm/values-custom.yaml -f helm/values-<industry>.yaml
   ```
   (`values-custom.yaml` holds your cluster/tenant secrets; the industry file only
   overrides the `industry:` block and a couple of top-level service toggles. Both
   are passed together — Helm merges them.)

> **Manual pitfall:** the authoring prompt alone does not cover Rules P1–P8 above. If
> your generated config produces empty entity screens, a blank fleet map, a blank
> status-map, or shows city flows (citizen/tax/store) you never asked for, see the
> rule table in Option A and add the missing pieces by hand. The validator will also
> catch many (not all) of these — see its checklist in
> [`.claude/agents/generate-industry-config.md`](../../.claude/agents/generate-industry-config.md).

---

## What the kit can and can't do

- **Can:** rebrand, relabel every portal screen/nav item, choose which screens + home
  modules appear (public portal only — ops-dashboard is a fixed Command Center + Demo
  Control app), define custom domain entities with typed fields, config-driven state
  machines, and signals that become Dynatrace Business Flow steps automatically, add a
  continuously-moving fleet via `journey-service`, generate industry-realistic demo
  data and dispatch routing, and rename the Dynatrace service map + Business Flows.
- **Can't:** invent brand-new screen components or modules — those require code. The kit
  **composes and re-skins Meridian's existing module library**. The prompt's catalog lists
  everything available; generic templates (`entity-list`, `entity-map`, `status-map`, etc.)
  cover most domain objects without any code.

---

## Reference

- **Full catalog + rules:** [`AUTHORING_PROMPT.md`](./AUTHORING_PROMPT.md)
- **Claude Code skill:** [`.claude/agents/generate-industry-config.md`](../../.claude/agents/generate-industry-config.md)
- **Validator:** [`../../scripts/validate-industry-config.mjs`](../../scripts/validate-industry-config.mjs)
- **Worked examples:** [`../../helm/values-airport.yaml`](../../helm/values-airport.yaml) (Meridian International Airport), [`../../helm/values-nhvr.yaml`](../../helm/values-nhvr.yaml) (National Heavy Vehicle Regulator — includes a `journey-service` trucking fleet)
- **Default ("Meridian City")**: the `industry:` block in [`../../helm/values.yaml`](../../helm/values.yaml) — this is not special-cased code, it's simply the base layer every overlay merges on top of
- **Schema:** [`../industry-config.schema.json`](../industry-config.schema.json)
- **How the generated config becomes a running demo:** [`../architecture.md`](../architecture.md)

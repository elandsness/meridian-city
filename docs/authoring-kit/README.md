# Meridian Industry Authoring Kit

Generate a Meridian demo config for **any** industry — no code required.

Meridian is a single app whose branding, terminology, screens, home/ops modules, demo
data, dispatch routing, and Dynatrace naming + business flows are all driven by one
`values-<industry>.yaml`. This kit gives an LLM everything it needs to author that file
for your industry.

There are two ways to use the kit — pick the one that fits your setup:

---

## Option A — Claude Code skill (recommended)

If you're working in this repo with [Claude Code](https://claude.ai/code), a purpose-built
skill handles the full workflow: research → design → generate → **validate → fix → repeat**
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

The skill wraps `AUTHORING_PROMPT.md` with four platform rules that the prompt doesn't
cover — gaps discovered from production deployments:

| Rule | What it enforces |
|------|-----------------|
| **P1 — ownedTypes overrides** | Every custom entity type with a `generator` must appear in `customerEntityService.ownedTypes` or `opsEntityService.ownedTypes` (outside the `industry:` block). Without this the entity engine never creates or transitions those entities — screens appear empty. |
| **P2 — IoT terminology** | When `iot` is in `screens.ops`, all six keys must be present in `terminology`: `iotCategory1/2/3` and `iotIdPrefix1/2/3`. Without them the IoT page and demo-control fleet panel fall back to the Meridian City defaults ("Vehicles / Buildings / Machines"). |
| **P3 — iotZonePositions** | When a `status-map` screen uses `clusterBy: zone`, `terminology.iotZonePositions` must map each zone id to an `{x, y}` cluster center in the map's viewBox. Without it no dots render. |
| **P4 — incidents paired with iot** | Whenever `iot` appears in `screens.ops`, `incidents` must also appear. The IoT page links to `/incidents` for anomaly-related incidents; if the screen is absent those links redirect to overview. |

The skill also maintains a quick-reference table of the 14 most common LLM generation
mistakes (fabricated `serviceNames` keys, invalid `flows` ids, `routing:` nested inside
`terminology:`, `entity-journey + ownerField` on custom entities, etc.) and checks all of
them before running the validator.

### After the skill finishes

1. The file is already written. Run CI by pushing the branch or triggering a workflow dispatch.
2. If you want a custom logo/favicon, commit the SVG assets to
   `frontends/public-portal/public/` before CI runs — they must be baked into the Docker
   image at build time.
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
   overrides the `industry:` block. Both are passed together -- Helm merges them.)

> **Manual pitfall:** the authoring prompt does not cover Rules P1–P4 above. If your
> generated config produces empty entity screens, an unthemed IoT page, or a blank
> status-map, see the rule table in Option A and add the missing pieces by hand.

---

## What the kit can and can't do

- **Can:** rebrand, relabel every screen/nav item, choose which screens + home/ops modules
  appear, define custom domain entities with typed fields and lifecycle state machines,
  generate industry-realistic demo data + dispatch routing, and rename the Dynatrace
  service map + business flows.
- **Can't:** invent brand-new screen components or modules — those require code. The kit
  **composes and re-skins Meridian's existing module library**. The prompt's catalog lists
  everything available; generic templates (`entity-list`, `entity-map`, `status-map`, etc.)
  cover most domain objects without any code.

---

## Reference

- **Full catalog + rules:** [`AUTHORING_PROMPT.md`](./AUTHORING_PROMPT.md)
- **Claude Code skill:** [`.claude/agents/generate-industry-config.md`](../../.claude/agents/generate-industry-config.md)
- **Validator:** [`../../scripts/validate-industry-config.mjs`](../../scripts/validate-industry-config.mjs)
- **Worked examples:** [`../../helm/values-airport.yaml`](../../helm/values-airport.yaml), [`../../helm/values-bank.yaml`](../../helm/values-bank.yaml), [`../../helm/values-baseball.yaml`](../../helm/values-baseball.yaml), [`../../helm/values-hospital.yaml`](../../helm/values-hospital.yaml), [`../../helm/values-powerutility.yaml`](../../helm/values-powerutility.yaml)
- **Default (Meridian City):** the `industry:` block in [`../../helm/values.yaml`](../../helm/values.yaml)
- **Schema:** [`../industry-config.schema.json`](../industry-config.schema.json)
- **Platform design:** [`../INDUSTRY_PLATFORM_PLAN.md`](../INDUSTRY_PLATFORM_PLAN.md)

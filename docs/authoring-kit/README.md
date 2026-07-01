# Meridian Industry Authoring Kit

Generate a Meridian demo config for **any** industry by pasting one prompt into an LLM.

Meridian is a single app whose branding, terminology, screens, home/ops modules, demo
data, dispatch routing, and Dynatrace naming + business flows are all driven by one
`values-<industry>.yaml`. This kit hands an LLM the full catalog + template so it can
author that file for your industry — no code required.

## Steps
1. Open [`AUTHORING_PROMPT.md`](./AUTHORING_PROMPT.md) and copy everything below the `---` line.
2. Paste it into any capable LLM (ChatGPT, Claude, Gemini, Copilot…).
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
   overrides the `industry:` block. Both are passed together — Helm merges them.)

## What it can and can't do
- **Can:** rebrand, relabel every screen/nav item, choose which screens + home/ops
  modules appear, generate industry-realistic demo data + dispatch routing, and rename
  the Dynatrace service map + business flows (and drop flows that don't apply).
- **Can't:** invent brand-new screen components or modules — those require code. The kit
  **composes and re-skins Meridian's existing module library**. The prompt's catalog
  lists everything available (generic modules work for any industry; a few are
  aviation-specific).

## Reference
- **Full catalog + template + rules:** [`AUTHORING_PROMPT.md`](./AUTHORING_PROMPT.md)
- **Worked example:** [`../../helm/values-airport.yaml`](../../helm/values-airport.yaml) (Meridian Airport)
- **Default (Meridian City):** the `industry:` block in [`../../helm/values.yaml`](../../helm/values.yaml)
- **Schema:** [`../industry-config.schema.json`](../industry-config.schema.json)
- **Platform design:** [`../INDUSTRY_PLATFORM_PLAN.md`](../INDUSTRY_PLATFORM_PLAN.md)

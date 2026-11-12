# CLAUDE.md

Guidance for Claude Code when working in this repo.

## What this is

Meridian — a **semantic demo-generation platform** for showcasing Dynatrace
observability, re-skinnable to any industry via a `values-<industry>.yaml`
overlay (see `docs/authoring-kit/`). "Meridian City" is just the default
industry profile, not a separate app. React frontends (`frontends/`), polyglot
backends (`services/`), deployed to Kubernetes via Helm (`helm/`). See
memory/project notes for which cluster is currently in use — it has moved
between a local kind/Rancher Desktop cluster and a GKE Autopilot cluster over
time; don't assume either without checking `kubectl config current-context`.

- Frontends: `public-portal`, `ops-dashboard` (React + Vite + react-query)
- Backends: Java/Spring (`entity-engine` — deployed twice as
  `customer-entity-service`/`ops-entity-service`; `identity-service`,
  `journey-service`, `workflow-service`, `transaction-service`, `routing-service`),
  Python/FastAPI (`analytics-service`, `ai-service`), Node (`api-gateway`,
  `demo-control-api`, `notification-service`, `traffic-bot`,
  `news-ticker-service`, `weather-service`), Go (`iot-simulator`,
  `movement-service`). This list isn't exhaustive — see `docs/architecture.md`
  for the maintained service-by-service reference.
- All traffic enters through `api-gateway`, which proxies `/api/v1/*` by prefix —
  partly a fixed route table, partly dynamic entity-domain routing driven by
  the active industry config (see `services/api-gateway/src/routes/proxy.js`).

## API conventions — READ BEFORE TOUCHING ANY ENDPOINT

The frontends and backends have **no shared schema** and have drifted, causing
many runtime-only bugs (blank screens, 500s, 502s, silently-empty UI).
**`docs/API_CONVENTIONS.md` is the contract** — follow it on both sides.

The rules that bite most often:

- **Casing: `snake_case` everywhere** (bodies, responses, query params). The Java
  services now set `spring.jackson.property-naming-strategy: SNAKE_CASE`, so they
  emit/accept snake_case at the API boundary. The only camelCase left is on
  **internal service-to-service DTOs**, pinned with `@JsonNaming(...LowerCamelCase...)`
  (e.g. the identity→customer-entity→ops-entity/workflow chain) — don't snake-case those.
- **Gateway forwards paths verbatim** for its fixed route table, except
  `/api/v1/demo-control/*`. A frontend path must match the upstream route
  *including the prefix* (e.g. `/api/v1/analytics/funnels/x` ≠ analytics-service's
  `/api/v1/funnels/x` → 404). Anything not in the fixed table is routed
  dynamically by entity `domain` — see `services/api-gateway/src/routes/proxy.js`.
- **Gateway must re-serialize JSON bodies** before forwarding to undici, or every
  proxied POST/PUT/PATCH 502s. (Handled in `proxy.js` — don't undo it.)
- **Don't make required query params that crash.** A custom
  `@ExceptionHandler(Exception.class)` catch-all with no more specific handler
  registered first turns a missing param or constraint violation into a
  **500**, not a 400 — `entity-engine`'s `GlobalExceptionHandler` is the fixed
  template to copy (specific handlers before the generic one).
- **Frontends must unwrap responses defensively** (`Array.isArray(d) ? d : d?.items ?? []`)
  — there are no React error boundaries, so one bad shape blanks the whole page.
- **`/api/v1/auth/login` is a gateway dispatcher.** `demo`/`dynatrace` → operator
  JWT (`user:{username, role:'operator'}`, no `id`). Otherwise the username is
  treated as a customer email and verified (email + BCrypt password) against
  `identity-service`; success mints a customer JWT whose `user.id` is the
  identity id. So a logged-in customer *does* have an identity (`user.id`), while
  the demo operator does not — flows that need a customer id should fall back
  when absent.

When adding/changing an endpoint, use the checklist in `docs/API_CONVENTIONS.md`.

## Build & deploy

- CI (`.github/workflows/build.yml`) builds and pushes images to
  `ghcr.io/elandsness/meridian-city/<name>:latest` **only on push to `main`.**
  A code change is not running anywhere until its PR merges and CI completes.
- Helm uses the floating `:latest` tag with `imagePullPolicy: Always`
  (`helm/values.yaml`) so redeploys pull fresh CI builds. If you pin an immutable
  tag, switch back to `IfNotPresent`.
- Deploy / teardown / seed: `scripts/deploy.sh`, `scripts/teardown.sh`,
  `scripts/seed-data.sh`. Verify a rebuild took by checking the Vite bundle hash
  changed in the browser.

## Multi-tenancy — READ BEFORE TOUCHING NAMES OR THE PROVISIONER

Many SEs run **concurrent** installs on the **same** cluster and the **same**
shared tenant (kyw96254). `scripts/deploy.sh install` generates a per-instance
**hash** and bakes it into the Helm release name `meridian-<hash>`, which is the
namespace and the single source of truth (`global.instanceHash`, fanned out via
`helm/templates/_helpers.tpl`). Rules:

- **Never hardcode `meridian-…` infra/observability identifiers.** Use the helpers
  (`meridian.fullname`, `meridian.namespace`, `meridian.kafkaBootstrap`,
  `meridian.dbRwService`, `meridian.appSecret`, `meridian.dynatraceTokensSecret`,
  `meridian.dynatrace.{clusterName,deploymentEnvironment,eventProvider}`). App
  workload names (`api-gateway`, `identity-service`, `customer-entity-service`, …)
  stay plain — they're namespace-isolated; only infra/identity names carry the hash.
- **Never hash anything an end user sees** (titles, store name, copy, logo). The
  user-facing brand is whatever the active `industry.company`/`theme`/`terminology`
  config says — "Meridian City" by default, something else entirely for any other
  `values-<industry>.yaml` — never the `meridian-<hash>` instance identifier.
- **Cluster-singleton operators are SHARED** (installed once by deploy.sh:
  CloudNativePG/`cnpg-system`, Strimzi/`strimzi-system` watchAnyNamespace, Dynatrace
  Operator/`dynatrace`). They are NOT chart sub-charts. Per-instance releases create
  only namespaced CRs. Teardown must never remove shared operators/CRDs/the
  `dynatrace` namespace (only `teardown.sh --with-shared-operators` does, when none remain).
- **The Dynatrace provisioner** (`helm/files/provision-dynatrace-business-config.py`)
  is per-instance (provider/pipeline/flows/routing keyed by hash + namespace) and has
  a `DT_ACTION=delete` path run by a pre-delete hook so `helm uninstall` removes only
  that instance's tenant objects. The shared `…logs.routing` object is merged, never
  overwritten. See `docs/dynatrace-config-guide.md` §3.1.

## Working agreements

- PRs are created via the GitHub web UI — do not run `gh pr create`. Push a fresh
  descriptive branch per task; never push directly to `main`.
- The cluster runs on a remote machine; provide commands for the user to run
  rather than executing kubectl/helm/docker directly.

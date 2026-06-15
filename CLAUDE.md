# CLAUDE.md

Guidance for Claude Code when working in this repo.

## What this is

Meridian City — a microservices demo platform for showcasing Dynatrace
observability. React frontends (`frontends/`), polyglot backends (`services/`),
deployed to Kubernetes via Helm (`helm/`) onto a local kind cluster.

- Frontends: `public-portal`, `ops-dashboard` (React + Vite + react-query)
- Backends: Java/Spring (`citizen-service`, `service-dispatch`, `city-operations`),
  Python/FastAPI (`analytics-service`, `ai-service`), Node
  (`api-gateway`, `demo-control-api`, `notification-service`, `traffic-bot`,
  `iot-*`)
- All traffic enters through `api-gateway`, which proxies `/api/v1/*` by prefix.

## API conventions — READ BEFORE TOUCHING ANY ENDPOINT

The frontends and backends have **no shared schema** and have drifted, causing
many runtime-only bugs (blank screens, 500s, 502s, silently-empty UI).
**`docs/API_CONVENTIONS.md` is the contract** — follow it on both sides.

The rules that bite most often:

- **Casing: `snake_case` everywhere** (bodies, responses, query params). The Java
  services now set `spring.jackson.property-naming-strategy: SNAKE_CASE`, so they
  emit/accept snake_case at the API boundary. The only camelCase left is on
  **internal service-to-service DTOs**, pinned with `@JsonNaming(...LowerCamelCase...)`
  (e.g. the citizen→dispatch→city-ops chain) — don't snake-case those.
- **Gateway forwards paths verbatim** except `/api/v1/demo-control/*`. A frontend
  path must match the upstream route *including the prefix* (e.g.
  `/api/v1/analytics/funnels/x` ≠ analytics-service's `/api/v1/funnels/x` → 404).
- **Gateway must re-serialize JSON bodies** before forwarding to undici, or every
  proxied POST/PUT/PATCH 502s. (Handled in `proxy.js` — don't undo it.)
- **Don't make required query params that crash.** citizen-service's catch-all
  `@ExceptionHandler(Exception.class)` turns a missing param or constraint
  violation into a **500**, not a 400.
- **Frontends must unwrap responses defensively** (`Array.isArray(d) ? d : d?.items ?? []`)
  — there are no React error boundaries, so one bad shape blanks the whole page.
- **`/api/v1/auth/login` is a gateway dispatcher.** `demo`/`dynatrace` → operator
  JWT (`user:{username, role:'operator'}`, no `id`). Otherwise the username is
  treated as a citizen email and verified (email + BCrypt password) against
  citizen-service; success mints a citizen JWT whose `user.id` is the citizen id.
  So a logged-in citizen *does* have an identity (`user.id`), while the demo
  operator does not — flows that need a citizen id should fall back when absent.

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

## Working agreements

- PRs are created via the GitHub web UI — do not run `gh pr create`. Push a fresh
  descriptive branch per task; never push directly to `main`.
- The cluster runs on a remote machine; provide commands for the user to run
  rather than executing kubectl/helm/docker directly.

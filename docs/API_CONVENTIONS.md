# Meridian City — API Conventions

This document codifies the cross-tier API contract for meridian-city. It exists
because the frontends (React) and backends (Spring / FastAPI / Node) were built
independently and drifted, producing a string of runtime-only bugs: blank
screens, 500s, 502s, and silently-empty UI. Every rule below maps to a real bug
we hit — see [Audit findings](#audit-findings) at the end.

There is **no shared schema or codegen** between tiers, so these conventions are
the contract. When you add or change an endpoint, follow them on *both* sides.

---

## 1. JSON property casing

**Standard: `snake_case` for all request bodies and response payloads.**

The platform is snake_case-majority: Python (analytics, ai) and Node
(demo-control, notification, traffic-bot) services and almost every frontend
consumer already use snake_case (`requests_today`, `device_id`,
`anomaly_type`, `created_at`). Only the Java/Spring services
(citizen-service, service-dispatch, city-operations) emit camelCase, because
Spring's default Jackson naming is camelCase and nothing overrides it.

**Java services must opt into snake_case** so they match everyone else:

```yaml
# application.yml
spring:
  jackson:
    property-naming-strategy: SNAKE_CASE
```

This changes both serialization (`createdAt` → `created_at`) and body
deserialization (`citizen_id` in the request binds to the `citizenId` field).
Note: it does **not** affect `@RequestParam` / `@PathVariable` names — those are
declared literally (see §2).

Until a service is converted, frontend consumers should read defensively:
`req.created_at ?? req.createdAt`.

## 2. Query & path parameters

- Name query params in `snake_case` (`citizen_id`, not `citizenId`). `@RequestParam`
  names are **not** touched by the Jackson strategy — spell them exactly as the
  client sends them.
- **Default to optional.** A required `@RequestParam` that a client omits throws,
  and in citizen-service the catch-all handler turns that into a **500** (§4).
  Use `required = false` with a sensible default and treat "absent" as a valid
  case (e.g. "list all" rather than "error").
- Accept and ignore unknown params (clients send `page` even where unused).

## 3. Response envelopes

Pick one shape per endpoint and document it. Today the platform mixes:

| Shape | Examples |
|---|---|
| Bare array | `GET /service-requests`, `GET /incidents`, `GET /assets` |
| `{ <key>: [...], count }` | `GET /kpis/history` → `{snapshots,count}`, `GET /notifications` → `{notifications,total}`, `GET /scenarios` → `{scenarios}` |
| `{ <name>, <key>: [...] }` | `GET /funnels/{n}` → `{funnel, stages}` |

**Rule:** collection endpoints return either a bare array **or** `{ items: [...], count }`
— be consistent within a service. Whichever you choose, **frontend consumers must
unwrap defensively** so a shape change can't blank the page (there are no React
error boundaries):

```js
const rows = Array.isArray(data) ? data : data?.items ?? data?.<key> ?? [];
// and guard the .map: (Array.isArray(rows) ? rows : []).map(...)
```

## 4. Errors & status codes

- Map **client** errors to 4xx, **server** errors to 5xx. Do not let a bad
  request surface as 500.
- citizen-service's `GlobalExceptionHandler` has a catch-all
  `@ExceptionHandler(Exception.class)` → 500. That's why a missing required param
  or a DB constraint violation shows up as 500 instead of 400/422. When adding
  validation, throw `ResponseStatusException` / `IllegalArgumentException` (mapped
  to the right status) rather than letting raw exceptions hit the catch-all. Add
  a handler for `MissingServletRequestParameterException` and
  `MethodArgumentNotValidException` → 400.
- Frontends read errors as `err.response?.data?.message ?? err.response?.data?.error`.
  Return a `message` field on error bodies.

## 5. API gateway (proxy) rules

The gateway (`services/api-gateway/src/routes/proxy.js`) is a prefix-based
passthrough. Two things bite repeatedly:

- **Body serialization.** Fastify parses JSON bodies into an object;
  undici needs a string/Buffer. The handler re-serializes objects to JSON and
  drops the inbound `content-length`. Don't undo this — any proxied POST/PUT/PATCH
  will 502 if the body is forwarded as a raw object.
- **Prefix rewrites.** Only `/api/v1/demo-control/*` is rewritten (→ `/api/v1/*`
  upstream). Every other prefix is forwarded **unchanged**. So a frontend path
  must match the upstream route exactly *including the prefix*. Calling
  `/api/v1/analytics/funnels/x` forwards verbatim to analytics-service, which only
  serves `/api/v1/funnels/x` → 404. Either align the frontend path to the upstream
  route, or add a `rewritePrefix` for that prefix in the route table.

When adding a new upstream route, add its prefix to `buildRouteTable` and confirm
the upstream path (with prefix) actually exists on the target service.

## 6. Auth & identity

- `/api/v1/auth/login` is handled **locally by the gateway** (hardcoded
  `demo/dynatrace`), returning `{ token, user: { username, role } }`. It is **not**
  proxied to citizen-service. Both the ops-dashboard and the public-portal use it,
  so the public-portal has **no per-citizen identity** — `user.id` is always
  undefined. Any flow that needs a citizen id must supply a real (seeded) one,
  not `user.id`.
- `EventSource` (SSE, `/api/v1/notifications/stream`) cannot send the `Authorization`
  header. Keep SSE endpoints unauthenticated at the gateway (they currently are).

---

## Adding or changing an endpoint — checklist

1. Path matches the upstream route **including the `/api/v1/...` prefix** the
   gateway forwards (§5).
2. Request body + response payload are `snake_case` (§1).
3. Query/path params are `snake_case`, optional with defaults where possible (§2).
4. Response envelope shape is documented and the frontend unwraps it defensively (§3).
5. Client errors return 4xx with a `message` field; no raw exception → 500 (§4).
6. The frontend consumer reads the exact keys the backend emits — verify both
   sides, including casing.

---

## Audit findings

From the 2026-06-09 cross-tier audit (gateway route table × both frontends ×
all backends). Severity: **High** = feature broken; **Med** = silent functional
gap (no crash, defensive frontend); **Low** = missing optional/cosmetic field.

| # | Sev | Endpoint | Problem | Fix side |
|---|-----|----------|---------|----------|
| 1 | High | `POST /api/v1/chat` | ai-service returns `{response}`; ChatWidget reads `data.reply` → empty bubble | frontend (read `response`) |
| 2 | High | `GET /api/v1/analytics/funnels/{n}` | gateway forwards verbatim; analytics serves `/api/v1/funnels/{n}` → **404**. Also `funnel`≠`funnel_name`, stage `stage`≠`name` | frontend path+keys (or gateway rewrite + backend keys) |
| 3 | High | `POST /api/v1/service-requests` | portal sends `citizen_id` (snake) = `user.id` (undefined; portal has no citizen identity); backend wants `citizenId` (non-null) → **500** | both: send valid seeded `citizen_id` + Java SNAKE_CASE |
| 4 | High | `GET /api/v1/kpis/history` | snapshot rows keyed `snapshot_at`; Overview reads `snap.timestamp` → chart X-axis labels broken | frontend (read `snapshot_at`) |
| 5 | High | `POST /api/v1/citizens` (Register) | portal sends `{name,email,phone,address}`; backend wants `{first_name,last_name,email,zone_id}` → fields unbound, likely 500 | both |
| 6 | Med | `GET /api/v1/demo-control/fault/status` | backend returns `{faults:{...}}`; DemoControl reads `faultStatus[serviceId]` (top level) → toggles don't reflect live state | frontend (read `.faults`) |
| 7 | Med | `GET /api/v1/demo-control/status` | backend returns `active_scenario`; DemoControl reads `scenario.active_scenario_id` → active highlight never shows | frontend |
| 8 | Med | `GET /api/v1/demo-control/traffic/status` | traffic-bot returns `rpm_current`/`rpm_normal`; DemoControl reads `rps` → rate display blank | frontend (or backend alias) |
| 9 | Med | `GET /api/v1/incidents` (portal Home/map) | backend returns no `location {lat,lng}` (nor `description`/`location_name`); CityMap plots nothing | backend (add fields) |
| 10 | Low | `GET /api/v1/incidents` (ops) | backend omits `work_order_count`, `service`, `resolved_at`; frontend handles via fallbacks | backend (optional) |

Items 1–4 are confirmed by reading both sides. Items 5–10 are confirmed from the
contract inventory; verify the exact entity/handler before applying each fix.

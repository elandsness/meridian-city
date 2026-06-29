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
`anomaly_type`, `created_at`). The Java/Spring services
(citizen-service, service-dispatch, city-operations) used to emit camelCase
(Spring's default Jackson naming); they now set the snake_case strategy so they
match everyone else:

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

All three Java services are converted. **Internal service-to-service DTOs are
deliberately pinned to camelCase** with `@JsonNaming(...LowerCamelCaseStrategy...)`
(the citizen → dispatch → city-ops chain), so do not snake-case those. Frontend
consumers can still read defensively (`req.created_at ?? req.createdAt`).

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
- **Bodyless / non-JSON POSTs.** Fastify only parses `application/json` and
  `text/plain`; anything else used to 415 **before** reaching the proxy. A
  bodyless action POST (e.g. `POST /api/v1/billing/bills/:id/pay`) trips this,
  because axios labels a no-body POST `application/x-www-form-urlencoded`. Since
  415 < 500 the callers never threw, so the failure was silent — the Tax Payment
  funnel stalled (bills issued, never paid). A catch-all content-type parser in
  `app.js` now buffers any non-JSON body raw so the proxy forwards it verbatim.
  Don't remove it; a reverse proxy must forward these, not reject them.
- **Prefix rewrites.** Only `/api/v1/demo-control/*` is rewritten (→ `/api/v1/*`
  upstream). Every other prefix is forwarded **unchanged**. So a frontend path
  must match the upstream route exactly *including the prefix*. Calling
  `/api/v1/analytics/funnels/x` forwards verbatim to analytics-service, which only
  serves `/api/v1/funnels/x` → 404. Either align the frontend path to the upstream
  route, or add a `rewritePrefix` for that prefix in the route table.

When adding a new upstream route, add its prefix to `buildRouteTable` and confirm
the upstream path (with prefix) actually exists on the target service.

## 6. Auth & identity

- `/api/v1/auth/login` is a **dispatcher in the gateway**. `demo`/`dynatrace` →
  operator JWT (`{ token, user: { username, role: 'operator' } }`, no `id`).
  Otherwise the username is treated as a **citizen email** and verified
  (email + BCrypt password) against citizen-service `POST /api/v1/auth/login`; on
  success the gateway mints a citizen JWT and returns
  `{ token, user: { id: <citizen_id>, username: <email>, name, role: 'citizen' } }`.
  So a logged-in citizen has `user.id`; the demo operator does not — flows that
  need a citizen id should fall back when it's absent. Citizen credentials are set
  at registration (`POST /api/v1/citizens` with a `password` → BCrypt account row
  in `citizens.accounts`); registration without a password (e.g. traffic-bot)
  creates a non-loginable citizen.
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

## Audit findings (resolved)

The 2026-06-09 cross-tier audit (gateway route table × both frontends × all
backends) turned up 10 contract mismatches — chat reply key, funnels routing,
new-request 500, kpis `snapshot_at`, register fields, demo-control fault wiring,
fleet/anomaly paths, and incident map fields. **All have since been fixed** (see
the `fix/*` PRs in the git history). The conventions in §§1–6 above are what keep
them from recurring — follow them when adding or changing an endpoint.

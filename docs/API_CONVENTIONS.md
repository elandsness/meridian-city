# Meridian Demo Platform — API Conventions

This document codifies the cross-tier API contract for the Meridian demo
platform. It exists because the frontends (React) and backends (Spring /
FastAPI / Node) were built independently and drifted, producing a string of
runtime-only bugs: blank screens, 500s, 502s, and silently-empty UI. Every
rule below maps to a real bug we hit — see [Audit findings](#audit-findings)
at the end.

> **Note:** the Java service names below reflect the current generic platform
> (`identity-service`, `workflow-service`, `customer-entity-service` /
> `ops-entity-service`, `transaction-service`, `journey-service`, `routing-service`).
> Older revisions of this doc referred to the pre-rewrite fixed-city services
> (`citizen-service`, `service-dispatch`, `city-operations`) — those no longer
> exist. See the README's [breaking-change notice](../README.md#-breaking-change--read-before-touching-an-existing-deployment-or-config)
> if you're working from an old checkout.

There is **no shared schema or codegen** between tiers, so these conventions are
the contract. When you add or change an endpoint, follow them on *both* sides.

---

## 1. JSON property casing

**Standard: `snake_case` for all request bodies and response payloads.**

The platform is snake_case-majority: Python (analytics, ai) and Node
(demo-control, notification, traffic-bot) services and almost every frontend
consumer already use snake_case (`requests_today`, `device_id`,
`anomaly_type`, `created_at`). The Java/Spring services (`identity-service`,
`workflow-service`, `customer-entity-service`/`ops-entity-service`,
`transaction-service`, `journey-service`, `routing-service`) used to emit
camelCase (Spring's default Jackson naming); they now set the snake_case
strategy so they match everyone else:

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

All Java services are converted. **Internal service-to-service DTOs are
deliberately pinned to camelCase** with `@JsonNaming(...LowerCamelCaseStrategy...)`
(the identity/customer-entity/ops-entity/workflow call chain), so do not
snake-case those. Frontend consumers can still read defensively
(`req.created_at ?? req.createdAt`).

## 2. Query & path parameters

- Name query params in `snake_case` (`entity_id`, not `entityId`). `@RequestParam`
  names are **not** touched by the Jackson strategy — spell them exactly as the
  client sends them.
- **Default to optional.** A required `@RequestParam` that a client omits throws
  `MissingServletRequestParameterException`; whether that surfaces as a 400 or a
  500 depends entirely on whether the service's exception handling special-cases
  it (§4) — don't assume Spring's default is in effect once any
  `@ExceptionHandler(Exception.class)` catch-all exists. Use `required = false`
  with a sensible default and treat "absent" as a valid case (e.g. "list all"
  rather than "error").
- Accept and ignore unknown params (clients send `page` even where unused).

## 3. Response envelopes

Pick one shape per endpoint and document it. Today the platform mixes:

| Shape | Examples |
|---|---|
| Bare array | `GET /api/v1/workflow/service-requests`, `GET /api/v1/workflow/incidents`, `GET /api/v1/workflow/assets` |
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
- Historically (pre-rewrite), `citizen-service`'s `GlobalExceptionHandler` had a
  catch-all `@ExceptionHandler(Exception.class)` → 500 with no more specific
  handlers registered first, so a missing required param or a DB constraint
  violation showed up as 500 instead of 400/422. `entity-engine`'s
  `GlobalExceptionHandler` fixes this (explicit `NoSuchElementException` → 404,
  `IllegalArgumentException`/`IllegalStateException` → 400,
  `MissingServletRequestParameterException` → 400, generic catch-all last) — use
  it as the template for any new service's exception handling. When adding
  validation, throw `ResponseStatusException` / `IllegalArgumentException`
  (mapped to the right status) rather than letting raw exceptions hit the
  catch-all, and register the specific handlers **before** the generic one.
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
  bodyless action POST (e.g. a payment/status-transition action with no body)
  trips this, because axios labels a no-body POST
  `application/x-www-form-urlencoded`. Since 415 < 500 the callers never threw,
  so the failure was silent — a transaction funnel stalled (bills issued, never
  paid) before this was caught. A catch-all content-type parser in `app.js` now
  buffers any non-JSON body raw so the proxy forwards it verbatim. Don't remove
  it; a reverse proxy must forward these, not reject them.
- **Prefix rewrites.** The gateway's `RouteResolver` (`services/api-gateway/src/routes/proxy.js`)
  checks a fixed `systemRoutes` prefix list first (`/api/v1/auth`, `/api/v1/identity`,
  `/api/v1/workflow`, `/api/v1/transaction`, `/api/v1/journeys`, `/api/v1/iot`,
  `/api/v1/chat`, `/api/v1/news`, `/api/v1/weather`, `/api/v1/demo-control`,
  `/api/v1/messages`) — these are forwarded **unchanged** except `/api/v1/demo-control/*`,
  which is rewritten to `/api/v1/*`. Anything else is resolved **dynamically**: the
  first path segment is looked up as an entity type in the active industry
  config's `industry.entities`, and routed by that entity's `domain`
  (`customer`/`ops`/`journey`/`identity`) to the matching service — so a custom
  industry entity type works with no gateway code change, but a typo'd path or an
  entity with no `domain` set resolves to nothing and 404s. Either align the
  frontend path to the upstream route, or add a prefix to `systemRoutes`.

When adding a new upstream route for a non-entity service, add its prefix to
`systemRoutes` and confirm the upstream path (with prefix) actually exists on
the target service.

## 6. Auth & identity

- `/api/v1/auth/login` is a **dispatcher in the gateway**. `demo`/`dynatrace` →
  operator JWT (`{ token, user: { username, role: 'operator' } }`, no `id`).
  Otherwise the username is treated as a **customer email** and verified
  (email + BCrypt password) against `identity-service`'s auth endpoint; on
  success the gateway mints a customer JWT and returns
  `{ token, user: { id: <identity_id>, username: <email>, name, role: 'customer' } }`.
  So a logged-in customer has `user.id`; the demo operator does not — flows that
  need a customer id should fall back when it's absent. Customer credentials are
  set at registration (`password` → BCrypt account row) via `identity-service`;
  registration without a password (e.g. traffic-bot) creates a non-loginable
  account.
- `EventSource` (SSE) cannot send the `Authorization` header, so any SSE endpoint
  must be unauthenticated at the gateway. Verify the current path still resolves
  through `systemRoutes` before relying on it — `notification-service` exposes
  its SSE stream under its own `/api/v1/notifications/stream` mount internally,
  but the gateway's `systemRoutes` list only forwards `/api/v1/messages`; confirm
  which prefix actually reaches it before wiring a new consumer to it.

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

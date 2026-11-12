# api-gateway

**Language**: Node.js 20 / Fastify  
**Port**: 3000

## Role

Single HTTP entry point for all traffic from the public portal and ops dashboard. Routes requests to downstream services. Provides JWT authentication for both dashboards.

## Responsibilities

- Route all `/api/v1/*` requests to appropriate backend services
- JWT authentication (see below) — issues short-lived tokens for the dashboards
- Inject `x-request-id` and `x-trace-id` headers for distributed trace correlation
- Aggregate health checks from all downstream services on `GET /health`

## Authentication

`POST /api/v1/auth/login` is a dispatcher:

- Operator login: `demo` / `dynatrace` is validated locally and mints an operator JWT.
- Otherwise the `username` is treated as a customer email and the password is verified
  against `identity-service`. On success it mints a customer JWT carrying the
  identity id, so the public portal can attach it to requests.

## Upstream services

Routing happens in two layers (`src/routes/proxy.js`'s `RouteResolver`):

1. **Fixed `systemRoutes` table** — forwarded verbatim except `/api/v1/demo-control/*`,
   which is rewritten (prefix stripped to `/api/v1`) and requires a valid operator JWT:

   | Route prefix | Proxied to |
   |---|---|
   | `/api/v1/auth`, `/api/v1/identity` | identity-service |
   | `/api/v1/workflow` | workflow-service |
   | `/api/v1/transaction` | transaction-service |
   | `/api/v1/journeys` | journey-service |
   | `/api/v1/iot` | iot-simulator |
   | `/api/v1/chat` | ai-service |
   | `/api/v1/news` | news-ticker-service |
   | `/api/v1/weather` | weather-service |
   | `/api/v1/messages` | notification-service |
   | `/api/v1/demo-control` | demo-control-api (prefix rewritten to `/api/v1`, requires auth) |

2. **Dynamic entity routing** — any other `/api/v1/<entityType>` or
   `/api/v1/entities/<entityType>` path is resolved by looking up `entityType` in
   the active industry config's `industry.entities`, then routing by that
   entity's `domain` (`customer`/`ops`/`journey`/`identity`) to
   `customer-entity-service`, `ops-entity-service`, `journey-service`, or
   `identity-service` respectively. An entity type with no `domain`, or a path
   segment that isn't a real entity type, resolves to nothing (404).

> **Known gap:** `ANALYTICS_SERVICE_URL` is configured (used for the aggregate
> `GET /health` check) but analytics-service has **no route in `systemRoutes`**
> and isn't reachable via the dynamic entity path either (`kpis`/`funnels` aren't
> entity types) — `/api/v1/kpis` and `/api/v1/funnels` currently 404 through the
> gateway. Confirm before relying on them; this looks like it didn't survive the
> move from the old static route table to the dynamic `RouteResolver`.

## Dynatrace instrumentation

OneAgent auto-instrumentation. All HTTP spans are captured automatically including downstream calls.

## Build

```bash
npm install
npm run dev      # local dev
npm run build
npm start
```

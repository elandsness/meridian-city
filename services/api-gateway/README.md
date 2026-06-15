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
- Otherwise the `username` is treated as a citizen email and the password is verified
  against citizen-service (`POST /api/v1/auth/login`). On success it mints a citizen
  JWT carrying the citizen id, so the public portal can attach it to requests.

## Upstream services

The gateway forwards each prefix verbatim except `/api/v1/demo-control/*`, which is
rewritten (the `/api/v1/demo-control` prefix is stripped down to `/api/v1`) and requires
a valid operator JWT.

| Route prefix | Proxied to |
|---|---|
| `/api/v1/citizens` | citizen-service |
| `/api/v1/service-requests` | citizen-service |
| `/api/v1/dispatch` | service-dispatch |
| `/api/v1/city` | city-operations |
| `/api/v1/assets` | city-operations |
| `/api/v1/incidents` | city-operations |
| `/api/v1/work-orders` | city-operations |
| `/api/v1/analytics` | analytics-service |
| `/api/v1/kpis` | analytics-service |
| `/api/v1/funnels` | analytics-service |
| `/api/v1/chat` | ai-service |
| `/api/v1/notifications` | notification-service |
| `/api/v1/demo-control` | demo-control-api (prefix rewritten to `/api/v1`, requires auth) |

## Dynatrace instrumentation

OneAgent auto-instrumentation. All HTTP spans are captured automatically including downstream calls.

## Build

```bash
npm install
npm run dev      # local dev
npm run build
npm start
```

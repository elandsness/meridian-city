# api-gateway

**Language**: Node.js 20 / Fastify  
**Port**: 3000  
**Status**: Phase 2 — not yet implemented

## Role

Single HTTP entry point for all traffic from the public portal and ops dashboard. Routes requests to downstream services. Provides mock authentication for the ops dashboard.

## Responsibilities

- Route all `/api/v1/*` requests to appropriate backend services
- Mock JWT authentication (validate `demo`/`dynatrace`, issue short-lived token for ops dashboard)
- Inject `x-request-id` and `x-trace-id` headers for distributed trace correlation
- Aggregate health checks from all downstream services on `GET /health`

## Upstream services

| Route prefix | Proxied to |
|---|---|
| `/api/v1/citizens/*` | citizen-service:8081 |
| `/api/v1/service-requests/*` | citizen-service:8081 / service-dispatch:8082 |
| `/api/v1/city/*` | city-operations:8083 |
| `/api/v1/analytics/*` | analytics-service:8084 |
| `/api/v1/chat/*` | ai-service:8085 |
| `/api/v1/notifications/*` | notification-service:8087 |
| `/api/v1/demo-control/*` | demo-control-api:3001 |

## Dynatrace instrumentation

OneAgent auto-instrumentation. All HTTP spans are captured automatically including downstream calls.

## Build

```bash
npm install
npm run dev      # local dev
npm run build
npm start
```

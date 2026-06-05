# traffic-bot

**Language**: Node.js 20  
**Port**: 8089 (control API)  
**Status**: Phase 7 — not yet implemented

## Role

Continuously simulates citizen user journeys against the public portal / API gateway, generating realistic distributed traces through the full service stack.

## Journey types

| Scenario | Weight | What it does |
|---|---|---|
| `browsing` | 40% | GET city info, buildings, service status |
| `citizenRequests` | 35% | Full request lifecycle: create account → submit request → check status |
| `accountCreation` | 15% | Register new citizen account |
| `chatbot` | 10% | 2-3 chatbot messages (disabled by default to avoid LLM cost) |

## Rate control

- `REQUESTS_PER_MINUTE` — total HTTP requests per minute across all journeys
- Each journey type runs on a weighted random schedule within the configured rate

## Burst mode

The demo-control-api can trigger burst mode: `POST /admin/burst` — sends 10× normal load for 2 minutes. Used to demo traffic-based anomaly detection.

## Admin API

- `GET /admin/status` — current rate, active journeys, RPM counter
- `POST /admin/pause` — pause all traffic
- `POST /admin/resume` — resume
- `POST /admin/burst` — trigger burst
- `GET /health`

## Dynatrace instrumentation

None — the bot is the load driver, not a subject of observation. The traffic it generates flows through api-gateway, which IS instrumented.

## Build

```bash
npm install
npm start
```

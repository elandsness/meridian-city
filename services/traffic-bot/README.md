# traffic-bot

**Language**: Node.js 20  
**Port**: 8089 (control API)

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

The demo-control-api can trigger burst mode: `POST /api/v1/burst` `{ duration_minutes? }` — sends 10× normal load (default 2 minutes). Used to demo traffic-based anomaly detection.

## Admin API

- `GET /api/v1/status` — current rate, active journeys, RPM counter
- `POST /api/v1/start` — start the journey loop
- `POST /api/v1/stop` — stop the journey loop
- `POST /api/v1/burst` — trigger burst `{ duration_minutes? }`
- `POST /api/v1/scenario` — run one journey `{ scenario }`
- `GET /health`

## Dynatrace instrumentation

None — the bot is the load driver, not a subject of observation. The traffic it generates flows through api-gateway, which IS instrumented.

## Build

```bash
npm install
npm start
```

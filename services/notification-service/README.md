# notification-service

**Language**: Node.js 20 / Express  
**Port**: 8087  
**Status**: Phase 5 — not yet implemented

## Role

Consumes IoT anomaly and service request events from Kafka and delivers in-app notifications to the ops dashboard via Server-Sent Events (SSE).

## Responsibilities

- Kafka consumer: `iot.anomalies`, `requests.events`, `notifications.outbound`
- Store recent notifications in memory (ring buffer, last 500)
- Serve live notification stream via SSE: `GET /api/v1/notifications/stream`
- REST endpoint for recent notification history

## Notification types

| Kafka topic | Notification |
|---|---|
| `iot.anomalies` | "⚠ IoT Anomaly: Building 07 HVAC temperature 87°C" |
| `requests.events` (submitted) | "New service request req-00901 submitted" |
| `requests.events` (resolved) | "Service request req-00456 resolved" |
| `notifications.outbound` | City-ops-generated alerts |

## Key endpoints

- `GET /api/v1/notifications/stream` — SSE stream (EventSource)
- `GET /api/v1/notifications?limit=20` — recent notifications
- `GET /health`

## Dynatrace instrumentation

OneAgent auto-instrumentation. Kafka consumer spans captured automatically.

## Build

```bash
npm install
npm run dev
```

# public-portal

**Framework**: React 18 / Vite  
**Port (container)**: 80 (nginx)  
**Status**: Phase 6 — not yet implemented

## Role

The citizen-facing public portal for the City of Meridian. Simulates what a city resident sees and uses to report issues, request services, and chat with the AI assistant.

## Pages / features

| Page | Path | Description |
|---|---|---|
| Home | `/` | City news, service status banner, quick-action buttons |
| Service Requests | `/requests` | Submit and track service requests |
| City Map | `/map` | Interactive map showing city assets and IoT device status |
| AI Chatbot | Floating widget | "Ask the City Assistant" — powered by ai-service |
| Account | `/account` | Register, login (mock auth), notification history |

## Tech stack

- React 18 + Vite
- Tailwind CSS (styling)
- React Query (data fetching / cache)
- Leaflet + react-leaflet (city map)
- Chart.js / react-chartjs-2 (service status charts)
- Axios (HTTP client)

## API integration

All API calls go to the API gateway (`VITE_API_URL` env var). No direct calls to backend services.

## Chatbot widget

- Floating button (bottom-right corner)
- Opens a chat panel
- Sends messages to `POST $VITE_API_URL/api/v1/chat`
- Displays markdown-rendered responses

## Build

```bash
npm install
npm run dev     # local dev on port 5173
npm run build   # production build → dist/
```

## Docker

The production image is a multi-stage build: Vite build + nginx:alpine serving the dist.

# public-portal

**Framework**: React 18 / Vite  
**Port (container)**: 80 (nginx)

## Role

The citizen-facing public portal for the City of Meridian. Simulates what a city resident sees and uses to report issues, request services, and chat with the AI assistant.

## Pages / features

| Page | Path | Description |
|---|---|---|
| Home | `/` | City news, service status banner, quick-action buttons |
| Login | `/login` | Citizen login with email + password |
| Register | `/register` | Register a citizen account (collects a password for login) |
| Service Requests | `/service-requests` | Track service requests (protected) |
| New Request | `/service-requests/new` | Submit a service request (protected) |
| AI Chatbot | Floating widget | "Ask the City Assistant" — powered by ai-service |
| City Map | `CityMap` component | Interactive map of city assets and IoT device status (embedded, not a route) |

Registration collects a password, and citizens log in with their email + password
(verified by citizen-service via the gateway login dispatcher).

## Tech stack

- React 18 + Vite
- Tailwind CSS (styling)
- React Query (data fetching / cache)
- Leaflet + react-leaflet (city map)
- Axios (HTTP client)

## API integration

All API calls go to the API gateway (`VITE_API_URL` env var). No direct calls to backend services.

## Chatbot widget

- Floating button (bottom-right corner)
- Opens a chat panel
- Sends messages to `POST $VITE_API_URL/api/v1/chat`
- Displays the assistant's plain-text responses

## Build

```bash
npm install
npm run dev     # local dev on port 5173
npm run build   # production build → dist/
```

## Docker

The production image is a multi-stage build: Vite build + nginx:alpine serving the dist.

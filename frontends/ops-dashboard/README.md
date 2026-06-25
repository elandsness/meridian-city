# ops-dashboard

**Framework**: React 18 / Vite  
**Port (container)**: 80 (nginx)

## Role

Internal operations dashboard for city operators AND the Demo Control Panel for SE/DXC use. Requires operator login (`demo` / `dynatrace`).

## Pages / features

| Tab | Path | Description |
|---|---|---|
| Overview | `/overview` | Live KPI tiles: requests/hr, open incidents, IoT anomalies, SLO health |
| IoT | `/iot` | Live telemetry per device category, plus an embedded `IoTMap` showing device status |
| Incidents | `/incidents` | Active and resolved incidents with drill-down to work orders |
| Business Analytics | `/analytics` | Business Event funnel visualizations for all three flows |
| **Demo Control** | `/demo-control` | Scenarios, failure injection, fleet management, traffic control (ops-only tab) |

The IoT device map is the `IoTMap` component embedded inside the IoT page — there is no
separate "City Map" route.

## Demo Control Panel features

### System Status
- Active scenario indicator
- **Reset All** button (always visible, clears all faults / anomalies / scenarios)

### Demo Scenarios
- Lists available scenarios (from demo-control-api) with Activate buttons and auto-reset durations

### Failure Injection
Per-service toggles (each calls demo-control-api's `POST /api/v1/fault/:service`):
- AI Service — LLM Latency (with seconds slider, 1–30s)
- Citizen Service — DB Slowdown (with seconds slider, 1–10s)
- Analytics Service — Memory Pressure

### IoT Fleet Management
- Per-category counts: Vehicles (1–100), Buildings (1–50), Machines (1–30) with an Apply button
- Anomaly injection: category + device ID + anomaly type, plus "Clear All Anomalies"

### Traffic Control
- Start / Stop traffic bot buttons
- Burst (2 min) button with countdown
- Current RPM display

## Tech stack

- React 18 + Vite
- Tailwind CSS
- React Query
- Recharts (KPI charts, trend lines)
- Leaflet + react-leaflet (city map)
- SSE EventSource (live notification stream from notification-service)

## Build

```bash
npm install
npm run dev     # local dev on port 5174
npm run build
```

## Docker

Multi-stage build: Vite + nginx:alpine.

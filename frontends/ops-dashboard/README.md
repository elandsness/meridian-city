# ops-dashboard

**Framework**: React 18 / Vite  
**Port (container)**: 80 (nginx)  
**Status**: Phase 6 — not yet implemented

## Role

Internal operations dashboard for city operators AND the Demo Control Panel for SE/DXC use. Requires mock authentication (login: `demo` / `dynatrace`).

## Pages / features

| Tab | Description |
|---|---|
| Overview | Live KPI tiles: requests/hr, open incidents, IoT anomalies, SLO health |
| City Map | Real-time IoT device map with status overlays (vehicle positions, building heat) |
| IoT Feed | Live telemetry stream per device category — vehicles, buildings, machines |
| Incidents | Active and resolved incidents with drill-down to work orders |
| Business Analytics | Business Event funnel visualizations for all three flows |
| SLO Status | Site Reliability Guardian SLO dashboard |
| **Demo Control** | Fleet manager, failure injection, traffic control (ops-only tab) |

## Demo Control Panel features

### Fleet Management
- Per-category sliders: Vehicles (1–100), Buildings (1–50), Machines (1–30)
- Live status: online/offline per device
- "Apply" button → calls demo-control-api

### Failure Injection buttons
- DB Slowdown (with active indicator, auto-reset countdown)
- Memory Pressure
- CPU Spike
- Kafka Consumer Lag
- LLM Latency
- Cascade Failure
- **Reset All** button (always visible, clears everything)

### IoT Anomaly Injection
- Per-category dropdowns with device selector
- "Trigger Anomaly" / "Resolve Anomaly" per device

### Traffic Control
- Burst Traffic button
- Stop/Resume traffic bot toggle
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

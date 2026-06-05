# analytics-service

**Language**: Python 3.12 / FastAPI  
**Port**: 8084  
**Status**: Phase 5 — not yet implemented

## Role

Computes KPIs for the ops dashboard and provides metrics for Dynatrace Site Reliability Guardian evaluation.

## Responsibilities

- Hourly KPI rollups: request volume, resolution rate, average resolution time, IoT anomaly rate
- Real-time dashboard aggregates (requests per hour, active incidents, SLO health)
- `/metrics` endpoint in Prometheus format for SRG SLO evaluation
- Business event funnel aggregations for the ops dashboard Business Analytics view

## Key endpoints

- `GET /api/v1/kpis` — current KPI snapshot
- `GET /api/v1/kpis/history?hours=24` — hourly KPI history
- `GET /metrics` — Prometheus-format metrics for SRG
- `GET /health`

## Dynatrace instrumentation

OneAgent auto-instrumentation (Python). No OTel SDK needed.

## Build

```bash
pip install -r requirements.txt
uvicorn main:app --reload    # local dev
```

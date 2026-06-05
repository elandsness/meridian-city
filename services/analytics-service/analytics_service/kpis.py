"""
KPI computation for analytics-service.

Queries multiple schemas owned by other services. Every query uses safe_fetchval
so a missing table or schema returns 0 rather than crashing the endpoint.

KPIs computed:
  requests_today          — service_requests submitted today
  requests_open           — service_requests not yet resolved/closed/cancelled
  requests_resolved_today — service_requests resolved today
  incidents_open          — open incidents
  iot_anomalies_24h       — IoT anomalies in the last 24 hours
  avg_resolution_hours    — mean resolution time (last 30 days, resolved requests)
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from .db import get_pool, safe_fetchval
from .fault import fault_state

logger = logging.getLogger(__name__)


async def compute_kpis() -> dict:
    """Return a fresh KPI snapshot dict. Safe to call at any time."""
    await fault_state.maybe_delay()

    pool = await get_pool()
    async with pool.acquire() as conn:
        requests_today = await safe_fetchval(conn, """
            SELECT COUNT(*) FROM requests.service_requests
            WHERE submitted_at >= CURRENT_DATE
        """)

        requests_open = await safe_fetchval(conn, """
            SELECT COUNT(*) FROM requests.service_requests
            WHERE status NOT IN ('resolved', 'closed', 'cancelled')
        """)

        requests_resolved_today = await safe_fetchval(conn, """
            SELECT COUNT(*) FROM requests.service_requests
            WHERE status = 'resolved'
              AND updated_at >= CURRENT_DATE
        """)

        incidents_open = await safe_fetchval(conn, """
            SELECT COUNT(*) FROM incidents.incidents
            WHERE status NOT IN ('resolved', 'closed')
        """)

        iot_anomalies_24h = await safe_fetchval(conn, """
            SELECT COUNT(*) FROM iot.anomalies
            WHERE detected_at >= NOW() - INTERVAL '24 hours'
        """)

        avg_resolution_raw = await safe_fetchval(conn, """
            SELECT COALESCE(
                EXTRACT(EPOCH FROM AVG(updated_at - submitted_at)) / 3600,
                0
            )
            FROM requests.service_requests
            WHERE status = 'resolved'
              AND updated_at >= NOW() - INTERVAL '30 days'
        """, default=0.0)

    return {
        "requests_today": int(requests_today),
        "requests_open": int(requests_open),
        "requests_resolved_today": int(requests_resolved_today),
        "incidents_open": int(incidents_open),
        "iot_anomalies_24h": int(iot_anomalies_24h),
        "avg_resolution_hours": round(float(avg_resolution_raw), 1),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

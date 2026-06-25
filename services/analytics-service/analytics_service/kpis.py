"""
KPI computation for analytics-service.

Queries multiple schemas owned by other services. Every query uses safe_fetchval
so a missing table or schema returns 0 rather than crashing the endpoint.

KPIs computed:
  requests_today          — service_requests created today
  requests_open           — service_requests not yet resolved/closed/cancelled
  requests_resolved_today — service_requests resolved today
  incidents_open          — open incidents
  iot_anomalies_24h       — IoT-sourced incidents in the last 24 hours
  avg_resolution_minutes  — mean resolution time (last 30 days, resolved requests)
  ai_chats_today          — chatbot interactions today (ai.chat_messages)
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
            WHERE created_at >= CURRENT_DATE
        """)

        requests_open = await safe_fetchval(conn, """
            SELECT COUNT(*) FROM requests.service_requests
            WHERE status NOT IN ('resolved', 'closed', 'cancelled')
        """)

        requests_resolved_today = await safe_fetchval(conn, """
            SELECT COUNT(*) FROM requests.service_requests
            WHERE status = 'resolved'
              AND resolved_at >= CURRENT_DATE
        """)

        incidents_open = await safe_fetchval(conn, """
            SELECT COUNT(*) FROM incidents.incidents
            WHERE status NOT IN ('resolved', 'closed')
        """)

        # IoT anomalies surface as incidents with source='iot'. (The dedicated
        # iot.anomalies table this once queried never existed — it always read 0.)
        iot_anomalies_24h = await safe_fetchval(conn, """
            SELECT COUNT(*) FROM incidents.incidents
            WHERE source = 'iot'
              AND created_at >= NOW() - INTERVAL '24 hours'
        """)

        # Mean resolution time over the last 30 days, in MINUTES — resolutions in
        # this demo run ~1-2 min, which rounded to 0.0 when expressed in hours.
        avg_resolution_minutes_raw = await safe_fetchval(conn, """
            SELECT COALESCE(
                EXTRACT(EPOCH FROM AVG(resolved_at - created_at)) / 60,
                0
            )
            FROM requests.service_requests
            WHERE status = 'resolved'
              AND resolved_at IS NOT NULL
              AND resolved_at >= NOW() - INTERVAL '30 days'
        """, default=0.0)

        # AI chats today — ai-service persists each chatbot interaction here.
        ai_chats_today = await safe_fetchval(conn, """
            SELECT COUNT(*) FROM ai.chat_messages
            WHERE created_at >= CURRENT_DATE
        """)

    avg_minutes = round(float(avg_resolution_minutes_raw), 1)
    return {
        "requests_today": int(requests_today),
        "requests_open": int(requests_open),
        "requests_resolved_today": int(requests_resolved_today),
        "incidents_open": int(incidents_open),
        "iot_anomalies_24h": int(iot_anomalies_24h),
        "avg_resolution_minutes": avg_minutes,
        # Kept (in hours) for the kpi_snapshots history table's existing column.
        "avg_resolution_hours": round(avg_minutes / 60, 2),
        "ai_chats_today": int(ai_chats_today),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

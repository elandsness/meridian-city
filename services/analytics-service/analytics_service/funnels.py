"""
Business process funnel data for analytics-service.

Three funnels match the Dynatrace Business Analytics demo scenarios:

  Flow A — service-request  : citizen request lifecycle
  Flow B — account-creation : citizen account registration
  Flow C — iot-incident     : IoT anomaly → incident → workorder resolution

For each funnel the stages are derived by querying request_events / work_orders
tables (owned by the Java services). Every query uses safe_fetchval so the
endpoint returns zeroed-out stages if the upstream tables haven't been created yet.
"""
from __future__ import annotations

import logging
from typing import List

from .db import get_pool, safe_fetchval

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Funnel stage definitions
# ---------------------------------------------------------------------------

_FUNNELS: dict[str, list[str]] = {
    "service-request": [
        "service_request.submitted",
        "service_request.validated",
        "service_request.dispatched",
        "service_request.assigned",
        "service_request.in_progress",
        "service_request.resolved",
    ],
    "account-creation": [
        "account.registration_started",
        "account.details_submitted",
        "account.verification_sent",
        "account.verified",
        "account.activated",
    ],
    "iot-incident": [
        "iot.anomaly_detected",
        "incident.created",
        "workorder.created",
        "workorder.assigned",
        "workorder.acknowledged",
        "workorder.resolved",
    ],
}

FUNNEL_NAMES = list(_FUNNELS.keys())


async def get_funnel(funnel_name: str) -> List[dict]:
    """
    Return stage-by-stage event counts for the named funnel.

    Queries request_events for Flow A/B and work_orders/incidents for Flow C.
    Falls back to zero counts if tables don't yet exist.
    """
    stages = _FUNNELS.get(funnel_name)
    if stages is None:
        return []

    pool = await get_pool()

    if funnel_name in ("service-request", "account-creation"):
        return await _query_event_log(pool, stages)
    else:
        return await _query_iot_incident_funnel(pool, stages)


async def _query_event_log(pool, stages: list[str]) -> list[dict]:
    """
    Count events per stage from requests.request_events.

    The Java services emit a row per lifecycle transition, e.g.:
      event_type = 'service_request.submitted', entity_id = 'req-00123'
    """
    result = []
    async with pool.acquire() as conn:
        for stage in stages:
            count = await safe_fetchval(conn, """
                SELECT COUNT(DISTINCT entity_id)
                FROM requests.request_events
                WHERE event_type = $1
            """, stage)
            result.append({"stage": stage, "count": int(count)})
    return result


async def _query_iot_incident_funnel(pool, stages: list[str]) -> list[dict]:
    """
    Derive IoT incident resolution funnel from iot.anomalies, incidents tables.

    Maps funnel stages to direct table counts:
      iot.anomaly_detected → iot.anomalies total
      incident.created     → incidents.incidents total
      workorder.created    → incidents.work_orders total
      workorder.assigned   → work_orders WHERE status != 'pending'
      workorder.acknowledged → work_orders WHERE status IN ('acknowledged','in_progress','resolved')
      workorder.resolved   → work_orders WHERE status = 'resolved'
    """
    async with pool.acquire() as conn:
        anomalies   = await safe_fetchval(conn, "SELECT COUNT(*) FROM iot.anomalies")
        incidents   = await safe_fetchval(conn, "SELECT COUNT(*) FROM incidents.incidents")
        wo_total    = await safe_fetchval(conn, "SELECT COUNT(*) FROM incidents.work_orders")
        wo_assigned = await safe_fetchval(conn, """
            SELECT COUNT(*) FROM incidents.work_orders
            WHERE status NOT IN ('pending', 'created')
        """)
        wo_acked    = await safe_fetchval(conn, """
            SELECT COUNT(*) FROM incidents.work_orders
            WHERE status IN ('acknowledged', 'in_progress', 'resolved')
        """)
        wo_resolved = await safe_fetchval(conn, """
            SELECT COUNT(*) FROM incidents.work_orders
            WHERE status = 'resolved'
        """)

    counts = [anomalies, incidents, wo_total, wo_assigned, wo_acked, wo_resolved]
    return [
        {"stage": stage, "count": int(count)}
        for stage, count in zip(stages, counts)
    ]

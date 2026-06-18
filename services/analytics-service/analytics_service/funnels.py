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
import os
from typing import List

from .db import get_pool, safe_fetchval

logger = logging.getLogger(__name__)

# Funnels show a recent window of activity rather than an ever-growing all-time
# total, so the numbers stay realistic in a long-running lab. Override via env.
WINDOW_HOURS = os.getenv("FUNNEL_WINDOW_HOURS", "24")


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
    # Flow D — City Store purchase funnel (derived from commerce.orders)
    "purchase": [
        "cart.item_added",
        "checkout.completed",
        "order.packed",
        "order.shipped",
        "order.delivered",
    ],
    # Flow E — Tax payment funnel (derived from billing.tax_bills)
    "tax-payment": [
        "tax.bill_issued",
        "tax.payment_completed",
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

    if funnel_name == "service-request":
        return await _query_event_log(pool, stages)
    elif funnel_name == "account-creation":
        return await _query_account_funnel(pool, stages)
    elif funnel_name == "purchase":
        return await _query_purchase_funnel(pool, stages)
    elif funnel_name == "tax-payment":
        return await _query_tax_funnel(pool, stages)
    else:
        return await _query_iot_incident_funnel(pool, stages)


async def _query_event_log(pool, stages: list[str]) -> list[dict]:
    """
    Count service-request events per stage from requests.request_events within the
    recent window. One row per lifecycle transition, e.g.:
      event_type = 'service_request.submitted', request_id = 'req-00123'
    """
    result = []
    async with pool.acquire() as conn:
        for stage in stages:
            count = await safe_fetchval(conn, """
                SELECT COUNT(DISTINCT request_id)
                FROM requests.request_events
                WHERE event_type = $1
                  AND created_at >= NOW() - ($2 || ' hours')::INTERVAL
            """, stage, WINDOW_HOURS)
            result.append({"stage": stage, "count": int(count)})
    return result


async def _query_account_funnel(pool, stages: list[str]) -> list[dict]:
    """
    Account-creation funnel from citizens.account_events (one row per lifecycle
    transition, written by citizen-service on registration). Counts distinct citizens
    per stage within the recent window.
    """
    result = []
    async with pool.acquire() as conn:
        for stage in stages:
            count = await safe_fetchval(conn, """
                SELECT COUNT(DISTINCT citizen_id)
                FROM citizens.account_events
                WHERE event_type = $1
                  AND created_at >= NOW() - ($2 || ' hours')::INTERVAL
            """, stage, WINDOW_HOURS)
            result.append({"stage": stage, "count": int(count)})
    return result


async def _query_iot_incident_funnel(pool, stages: list[str]) -> list[dict]:
    """
    Derive IoT incident resolution funnel from iot.anomalies, incidents tables.

    Maps funnel stages to direct table counts. Work-order stages are scoped to
    incident-linked work orders (incident_id IS NOT NULL) so the funnel reads as a
    proper IoT funnel and excludes service-request work orders:
      iot.anomaly_detected → iot.anomalies total
      incident.created     → incidents.incidents total
      workorder.created    → incident-linked work_orders total
      workorder.assigned   → incident-linked work_orders WHERE status NOT IN ('pending','created')
      workorder.acknowledged → incident-linked work_orders WHERE status IN ('acknowledged','in_progress','resolved')
      workorder.resolved   → incident-linked work_orders WHERE status = 'resolved'
    """
    async with pool.acquire() as conn:
        anomalies   = await safe_fetchval(conn, """
            SELECT COUNT(*) FROM iot.anomalies
            WHERE detected_at >= NOW() - ($1 || ' hours')::INTERVAL
        """, WINDOW_HOURS)
        incidents   = await safe_fetchval(conn, """
            SELECT COUNT(*) FROM incidents.incidents
            WHERE created_at >= NOW() - ($1 || ' hours')::INTERVAL
        """, WINDOW_HOURS)
        wo_total    = await safe_fetchval(conn, """
            SELECT COUNT(*) FROM incidents.work_orders
            WHERE incident_id IS NOT NULL
              AND created_at >= NOW() - ($1 || ' hours')::INTERVAL
        """, WINDOW_HOURS)
        wo_assigned = await safe_fetchval(conn, """
            SELECT COUNT(*) FROM incidents.work_orders
            WHERE incident_id IS NOT NULL AND status NOT IN ('pending', 'created')
              AND created_at >= NOW() - ($1 || ' hours')::INTERVAL
        """, WINDOW_HOURS)
        wo_acked    = await safe_fetchval(conn, """
            SELECT COUNT(*) FROM incidents.work_orders
            WHERE incident_id IS NOT NULL AND status IN ('acknowledged', 'in_progress', 'resolved')
              AND created_at >= NOW() - ($1 || ' hours')::INTERVAL
        """, WINDOW_HOURS)
        wo_resolved = await safe_fetchval(conn, """
            SELECT COUNT(*) FROM incidents.work_orders
            WHERE incident_id IS NOT NULL AND status = 'resolved'
              AND created_at >= NOW() - ($1 || ' hours')::INTERVAL
        """, WINDOW_HOURS)

    counts = [anomalies, incidents, wo_total, wo_assigned, wo_acked, wo_resolved]
    return [
        {"stage": stage, "count": int(count)}
        for stage, count in zip(stages, counts)
    ]


async def _query_purchase_funnel(pool, stages: list[str]) -> list[dict]:
    """
    City Store purchase funnel from commerce.carts / commerce.orders:
      cart.item_added    → carts created (shopping sessions)
      checkout.completed → orders placed
      order.packed/shipped/delivered → orders with the matching *_at timestamp
    """
    async with pool.acquire() as conn:
        carts     = await safe_fetchval(conn, """
            SELECT COUNT(*) FROM commerce.carts
            WHERE created_at >= NOW() - ($1 || ' hours')::INTERVAL
        """, WINDOW_HOURS)
        orders    = await safe_fetchval(conn, """
            SELECT COUNT(*) FROM commerce.orders
            WHERE created_at >= NOW() - ($1 || ' hours')::INTERVAL
        """, WINDOW_HOURS)
        packed    = await safe_fetchval(conn, """
            SELECT COUNT(*) FROM commerce.orders
            WHERE packed_at IS NOT NULL
              AND created_at >= NOW() - ($1 || ' hours')::INTERVAL
        """, WINDOW_HOURS)
        shipped   = await safe_fetchval(conn, """
            SELECT COUNT(*) FROM commerce.orders
            WHERE shipped_at IS NOT NULL
              AND created_at >= NOW() - ($1 || ' hours')::INTERVAL
        """, WINDOW_HOURS)
        delivered = await safe_fetchval(conn, """
            SELECT COUNT(*) FROM commerce.orders
            WHERE delivered_at IS NOT NULL
              AND created_at >= NOW() - ($1 || ' hours')::INTERVAL
        """, WINDOW_HOURS)

    counts = [carts, orders, packed, shipped, delivered]
    return [
        {"stage": stage, "count": int(count)}
        for stage, count in zip(stages, counts)
    ]


async def _query_tax_funnel(pool, stages: list[str]) -> list[dict]:
    """
    Tax payment funnel from billing.tax_bills:
      tax.bill_issued        → total bills
      tax.payment_completed  → bills with status = 'paid'
    """
    async with pool.acquire() as conn:
        issued = await safe_fetchval(conn, """
            SELECT COUNT(*) FROM billing.tax_bills
            WHERE created_at >= NOW() - ($1 || ' hours')::INTERVAL
        """, WINDOW_HOURS)
        paid   = await safe_fetchval(conn, """
            SELECT COUNT(*) FROM billing.tax_bills
            WHERE status = 'paid'
              AND created_at >= NOW() - ($1 || ' hours')::INTERVAL
        """, WINDOW_HOURS)

    counts = [issued, paid]
    return [
        {"stage": stage, "count": int(count)}
        for stage, count in zip(stages, counts)
    ]

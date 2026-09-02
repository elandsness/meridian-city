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
        "service_request.in_progress",
        "service_request.resolved",
    ],
    "account-creation": [
        "citizen.verification_sent",
        "citizen.verified",
        "citizen.activated",
    ],
    "iot-incident": [
        "iot.anomaly_detected",
        "incident.created",
        "workorder.created",
        "workorder.assigned",
        "workorder.acknowledged",
        "workorder.resolved",
    ],
    # Flow D — City Store purchase funnel (derived from entity events)
    "purchase": [
        "cart.item_added",
        "checkout.completed",
        "order.packed",
        "order.shipped",
        "order.delivered",
    ],
    # Flow E — Billing payment funnel (derived from entity events)
    "tax-payment": [
        "bill.outstanding",
        "bill.paid",
    ],
    # Flow F — Loan application funnel (entity engine)
    "loan_application": [
        "loan_application.submitted",
        "loan_application.credit_check",
        "loan_application.underwriting",
        "loan_application.approved",
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
    elif funnel_name == "loan_application":
        return await _query_entity_event_funnel(pool, "loan_application", stages)
    else:
        return await _query_iot_incident_funnel(pool, stages)


async def _query_event_log(pool, stages: list[str]) -> list[dict]:
    """
    Count service-request events per stage from entities.entity_event.

    Uses cohort-based counting: only consider entities whose CREATION falls
    within the recent window, then count how many reached each stage regardless
    of when that transition happened. This avoids the classic funnel inversion
    where a rolling event-timestamp window counts later-stage events for
    entities submitted before the window.
    """
    result = []
    async with pool.acquire() as conn:
        for stage in stages:
            count = await safe_fetchval(conn, """
                SELECT COUNT(DISTINCT ee.entity_id)
                FROM entities.entity_event ee
                JOIN entities.entity e ON e.id = ee.entity_id
                WHERE ee.entity_type = 'service_request'
                  AND ee.event_type = $1
                  AND e.created_at >= NOW() - ($2 || ' hours')::INTERVAL
            """, stage, WINDOW_HOURS)
            result.append({"stage": stage, "count": int(count)})
    return result


async def _query_account_funnel(pool, stages: list[str]) -> list[dict]:
    """
    Account-creation funnel from entities.entity_event (citizen entity lifecycle).
    Citizen initial state is verification_sent; stages follow citizen.<state> naming.
    """
    result = []
    async with pool.acquire() as conn:
        for stage in stages:
            count = await safe_fetchval(conn, """
                SELECT COUNT(DISTINCT ee.entity_id)
                FROM entities.entity_event ee
                JOIN entities.entity e ON e.id = ee.entity_id
                WHERE ee.entity_type = 'citizen'
                  AND ee.event_type = $1
                  AND e.created_at >= NOW() - ($2 || ' hours')::INTERVAL
            """, stage, WINDOW_HOURS)
            result.append({"stage": stage, "count": int(count)})
    return result


async def _query_iot_incident_funnel(pool, stages: list[str]) -> list[dict]:
    """
    Derive IoT incident resolution funnel from iot.anomalies (owned by
    telemetry-processor) and entities.entity_event (owned by entity engine).
    """
    async with pool.acquire() as conn:
        anomalies   = await safe_fetchval(conn, """
            SELECT COUNT(*) FROM iot.anomalies
            WHERE detected_at >= NOW() - ($1 || ' hours')::INTERVAL
        """, WINDOW_HOURS)
        incidents   = await safe_fetchval(conn, """
            SELECT COUNT(*) FROM entities.entity_event
            WHERE entity_type = 'incident' AND event_type = 'incident.detecting'
              AND occurred_at >= NOW() - ($1 || ' hours')::INTERVAL
        """, WINDOW_HOURS)
        wo_total    = await safe_fetchval(conn, """
            SELECT COUNT(*) FROM entities.entity_event ee
            JOIN entities.entity e ON e.id = ee.entity_id
            WHERE ee.entity_type = 'work_order' AND ee.event_type = 'work_order.created'
              AND e.links->>'incident_id' IS NOT NULL
              AND ee.occurred_at >= NOW() - ($1 || ' hours')::INTERVAL
        """, WINDOW_HOURS)
        wo_assigned = await safe_fetchval(conn, """
            SELECT COUNT(*) FROM entities.entity_event ee
            JOIN entities.entity e ON e.id = ee.entity_id
            WHERE ee.entity_type = 'work_order' AND ee.event_type = 'work_order.assigned'
              AND e.links->>'incident_id' IS NOT NULL
              AND ee.occurred_at >= NOW() - ($1 || ' hours')::INTERVAL
        """, WINDOW_HOURS)
        wo_acked    = await safe_fetchval(conn, """
            SELECT COUNT(*) FROM entities.entity_event ee
            JOIN entities.entity e ON e.id = ee.entity_id
            WHERE ee.entity_type = 'work_order' AND ee.event_type = 'work_order.acknowledged'
              AND e.links->>'incident_id' IS NOT NULL
              AND ee.occurred_at >= NOW() - ($1 || ' hours')::INTERVAL
        """, WINDOW_HOURS)
        wo_resolved = await safe_fetchval(conn, """
            SELECT COUNT(*) FROM entities.entity_event ee
            JOIN entities.entity e ON e.id = ee.entity_id
            WHERE ee.entity_type = 'work_order' AND ee.event_type = 'work_order.resolved'
              AND e.links->>'incident_id' IS NOT NULL
              AND ee.occurred_at >= NOW() - ($1 || ' hours')::INTERVAL
        """, WINDOW_HOURS)

    counts = [anomalies, incidents, wo_total, wo_assigned, wo_acked, wo_resolved]
    return [
        {"stage": stage, "count": int(count)}
        for stage, count in zip(stages, counts)
    ]


async def _query_purchase_funnel(pool, stages: list[str]) -> list[dict]:
    """
    City Store purchase funnel from entities.entity_event (cart entity lifecycle).
    Falls back gracefully to zero if the entity engine has no cart events yet.
    """
    stage_events = [
        "cart.open",          # cart created
        "cart.checked_out",   # checkout completed
        "cart.packed",
        "cart.shipped",
        "cart.delivered",
    ]
    result = []
    async with pool.acquire() as conn:
        for stage, event in zip(stages, stage_events):
            count = await safe_fetchval(conn, """
                SELECT COUNT(*) FROM entities.entity_event
                WHERE entity_type = 'cart' AND event_type = $1
                  AND occurred_at >= NOW() - ($2 || ' hours')::INTERVAL
            """, event, WINDOW_HOURS)
            result.append({"stage": stage, "count": int(count)})
    return result


async def _query_tax_funnel(pool, stages: list[str]) -> list[dict]:
    """
    Billing payment funnel from entities.entity_event (bill entity lifecycle).
    Works for city (tax bills) and bank (credit card statements) — both use
    the 'bill' entity type with outstanding→paid states.
    """
    async with pool.acquire() as conn:
        issued = await safe_fetchval(conn, """
            SELECT COUNT(*) FROM entities.entity_event
            WHERE entity_type = 'bill' AND event_type = 'bill.outstanding'
              AND occurred_at >= NOW() - ($1 || ' hours')::INTERVAL
        """, WINDOW_HOURS)
        paid   = await safe_fetchval(conn, """
            SELECT COUNT(*) FROM entities.entity_event
            WHERE entity_type = 'bill' AND event_type = 'bill.paid'
              AND occurred_at >= NOW() - ($1 || ' hours')::INTERVAL
        """, WINDOW_HOURS)

    counts = [issued, paid]
    return [
        {"stage": stage, "count": int(count)}
        for stage, count in zip(stages, counts)
    ]


async def _query_entity_event_funnel(pool, entity_type: str, stages: list[str]) -> list[dict]:
    """
    Generic funnel over entities.entity_event. Each stage key must match an
    event_type emitted by the entity engine (<entityType>.<state>).
    """
    result = []
    async with pool.acquire() as conn:
        for stage in stages:
            count = await safe_fetchval(conn, """
                SELECT COUNT(DISTINCT entity_id) FROM entities.entity_event
                WHERE entity_type = $1 AND event_type = $2
                  AND occurred_at >= NOW() - ($3 || ' hours')::INTERVAL
            """, entity_type, stage, WINDOW_HOURS)
            result.append({"stage": stage, "count": int(count)})
    return result

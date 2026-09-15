"""
Business process funnel data for analytics-service.
"""
from __future__ import annotations
import logging
import os
from typing import List
from .db import get_pool, safe_fetchval

logger = logging.getLogger(__name__)
WINDOW_HOURS = os.getenv("FUNNEL_WINDOW_HOURS", "24")

_FUNNELS: dict[str, list[str]] = {
    "service-request": ["service_request.submitted", "service_request.validated", "service_request.in_progress", "service_request.resolved"],
    "account-creation": ["citizen.verification_sent", "citizen.verified", "citizen.activated"],
    "iot-incident": ["iot.anomaly_detected", "incident.detecting", "work_order.created", "work_order.assigned", "work_order.acknowledged", "work_order.resolved"],
    "purchase": ["cart.item_added", "checkout.completed", "order.packed", "order.shipped", "order.delivered"],
    "tax-payment": ["bill.outstanding", "bill.paid"],
    "loan_application": ["loan_application.submitted", "loan_application.credit_check", "loan_application.underwriting", "loan_application.approved"],
    "flight_departure": ["flight_departure.at_gate", "flight_departure.boarding", "flight_departure.taxiing", "flight_departure.takeoff", "flight_departure.departed"],
    "passenger": ["passenger.checked_in", "passenger.security_cleared", "passenger.gate_ready", "passenger.boarded", "passenger.departed"],
}

FUNNEL_NAMES = list(_FUNNELS.keys())

async def get_funnel(funnel_name: str) -> List[dict]:
    stages = _FUNNELS.get(funnel_name)
    if stages is None: return []
    pool = await get_pool()
    if funnel_name == "service-request": return await _query_event_log(pool, stages)
    elif funnel_name == "account-creation": return await _query_account_funnel(pool, stages)
    elif funnel_name == "purchase": return await _query_purchase_funnel(pool, stages)
    elif funnel_name == "tax-payment": return await _query_tax_funnel(pool, stages)
    elif funnel_name == "loan_application": return await _query_entity_event_funnel(pool, "loan_application", stages)
    elif funnel_name in ["flight_departure", "passenger"]: return await _query_entity_event_funnel(pool, funnel_name, stages)
    else: return await _query_iot_incident_funnel(pool, stages)

async def _query_event_log(pool, stages: list[str]) -> list[dict]:
    result = []
    async with pool.acquire() as conn:
        for stage in stages:
            count = await safe_fetchval(conn, "SELECT COUNT(DISTINCT ee.entity_id) FROM entities.entity_event ee JOIN entities.entity e ON e.id = ee.entity_id WHERE ee.entity_type = 'service_request' AND ee.event_type = $1 AND e.created_at >= NOW() - ($2 || ' hours')::INTERVAL", stage, WINDOW_HOURS)
            result.append({"stage": stage, "count": int(count)})
    return result

async def _query_account_funnel(pool, stages: list[str]) -> list[dict]:
    result = []
    async with pool.acquire() as conn:
        for stage in stages:
            count = await safe_fetchval(conn, "SELECT COUNT(DISTINCT ee.entity_id) FROM entities.entity_event ee JOIN entities.entity e ON e.id = ee.entity_id WHERE ee.entity_type = 'citizen' AND ee.event_type = $1 AND e.created_at >= NOW() - ($2 || ' hours')::INTERVAL", stage, WINDOW_HOURS)
            result.append({"stage": stage, "count": int(count)})
    return result

async def _query_iot_incident_funnel(pool, stages: list[str]) -> list[dict]:
    async with pool.acquire() as conn:
        anomalies = await safe_fetchval(conn, "SELECT COUNT(*) FROM iot.anomalies WHERE detected_at >= NOW() - ($1 || ' hours')::INTERVAL", WINDOW_HOURS)
        incidents = await safe_fetchval(conn, "SELECT COUNT(*) FROM entities.entity_event WHERE entity_type = 'incident' AND event_type = 'incident.detecting' AND occurred_at >= NOW() - ($1 || ' hours')::INTERVAL", WINDOW_HOURS)
        wo_total = await safe_fetchval(conn, "SELECT COUNT(*) FROM entities.entity_event ee JOIN entities.entity e ON e.id = ee.entity_id WHERE ee.entity_type = 'work_order' AND ee.event_type = 'work_order.created' AND e.links->>'incident_id' IS NOT NULL AND ee.occurred_at >= NOW() - ($1 || ' hours')::INTERVAL", WINDOW_HOURS)
        wo_assigned = await safe_fetchval(conn, "SELECT COUNT(*) FROM entities.entity_event ee JOIN entities.entity e ON e.id = ee.entity_id WHERE ee.entity_type = 'work_order' AND ee.event_type = 'work_order.assigned' AND e.links->>'incident_id' IS NOT NULL AND ee.occurred_at >= NOW() - ($1 || ' hours')::INTERVAL", WINDOW_HOURS)
        wo_acked = await safe_fetchval(conn, "SELECT COUNT(*) FROM entities.entity_event ee JOIN entities.entity e ON e.id = ee.entity_id WHERE ee.entity_type = 'work_order' AND ee.event_type = 'work_order.acknowledged' AND e.links->>'incident_id' IS NOT NULL AND ee.occurred_at >= NOW() - ($1 || ' hours')::INTERVAL", WINDOW_HOURS)
        wo_resolved = await safe_fetchval(conn, "SELECT COUNT(*) FROM entities.entity_event ee JOIN entities.entity e ON e.id = ee.entity_id WHERE ee.entity_type = 'work_order' AND ee.event_type = 'work_order.resolved' AND e.links->>'incident_id' IS NOT NULL AND ee.occurred_at >= NOW() - ($1 || ' hours')::INTERVAL", WINDOW_HOURS)
    counts = [anomalies, incidents, wo_total, wo_assigned, wo_acked, wo_resolved]
    return [{"stage": stage, "count": int(count)} for stage, count in zip(stages, counts)]

async def _query_purchase_funnel(pool, stages: list[str]) -> list[dict]:
    stage_events = ["cart.open", "cart.checked_out", "cart.packed", "cart.shipped", "cart.delivered"]
    result = []
    async with pool.acquire() as conn:
        for stage, event in zip(stages, stage_events):
            count = await safe_fetchval(conn, "SELECT COUNT(*) FROM entities.entity_event WHERE entity_type = 'cart' AND event_type = $1 AND occurred_at >= NOW() - ($2 || ' hours')::INTERVAL", event, WINDOW_HOURS)
            result.append({"stage": stage, "count": int(count)})
    return result

async def _query_tax_funnel(pool, stages: list[str]) -> list[dict]:
    async with pool.acquire() as conn:
        issued = await safe_fetchval(conn, "SELECT COUNT(*) FROM entities.entity_event WHERE entity_type = 'bill' AND event_type = 'bill.outstanding' AND occurred_at >= NOW() - ($1 || ' hours')::INTERVAL", WINDOW_HOURS)
        paid = await safe_fetchval(conn, "SELECT COUNT(*) FROM entities.entity_event WHERE entity_type = 'bill' AND event_type = 'bill.paid' AND occurred_at >= NOW() - ($1 || ' hours')::INTERVAL", WINDOW_HOURS)
    return [{"stage": stage, "count": int(count)} for stage, count in zip(stages, [issued, paid])]

async def _query_entity_event_funnel(pool, entity_type: str, stages: list[str]) -> list[dict]:
    result = []
    async with pool.acquire() as conn:
        for stage in stages:
            count = await safe_fetchval(conn, "SELECT COUNT(DISTINCT entity_id) FROM entities.entity_event WHERE entity_type = $1 AND event_type = $2 AND occurred_at >= NOW() - ($3 || ' hours')::INTERVAL", entity_type, stage, WINDOW_HOURS)
            result.append({"stage": stage, "count": int(count)})
    return result

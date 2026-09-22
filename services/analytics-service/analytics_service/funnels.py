"""
Business process funnel data for analytics-service.
"""
from __future__ import annotations
import logging
import os
import json
from typing import List, Any
from .db import get_pool, safe_fetchval

logger = logging.getLogger(__name__)
WINDOW_HOURS = os.getenv("FUNNEL_WINDOW_HOURS", "24")
CONFIG_PATH = os.getenv("INDUSTRY_CONFIG_PATH", "/etc/config/config.json")

class DynamicFunnelList(list):
    """
    A list subclass that dynamically updates its members based on the industry config.
    This prevents a breaking change to the API surface while moving to a generic engine.
    """
    def __contains__(self, item):
        try:
            funnels = load_funnel_definitions()
            return item in funnels
        except Exception:
            return False

    def __repr__(self):
        try:
            return str(list(load_funnel_definitions().keys()))
        except Exception:
            return "[]"

# The API depends on this constant to validate incoming funnel names.
# By using a custom collection, we stay generic without breaking the API.
FUNNEL_NAMES = DynamicFunnelList()

async def load_funnel_definitions() -> dict[str, list[str]]:
    """
    Dynamically derives funnel sequences from the entity definitions in the industry config.
    """
    try:
        if os.path.exists(CONFIG_PATH):
            with open(CONFIG_PATH, 'r') as f:
                config = json.load(f)
                entities = config.get("entities", {})
                
                # Map flow names to generic domain nouns defined in the terminology config
                flow_to_noun = {
                    "service-request": "request",
                    "account-creation": "customer",
                    "iot-incident": "incident",
                    "flight_departure": "flight",
                    "passenger": "passenger",
                }
                
                terminology = config.get("terminology", {})
                derived_funnels = {}
                for flow, noun in flow_to_noun.items():
                    # Resolve generic noun to the actual entity type key (fallback to noun itself)
                    entity_type = terminology.get(noun, noun)
                    entity_def = entities.get(entity_type)
                    if entity_def and "states" in entity_def:
                        states = list(entity_def["states"].keys())
                        derived_funnels[flow] = [f"{entity_type}.{s}" for s in states]
                
                return derived_funnels
    except Exception as e:
        logger.error(f"Failed to dynamically derive funnels: {e}")
    
    return {}

async def get_funnel(funnel_name: str) -> List[dict]:
    funnels = await load_funnel_definitions()
    stages = funnels.get(funnel_name)
    if stages is None: return []
    
    pool = await get_pool()
    
    if funnel_name == "iot-incident": 
        return await _query_iot_incident_funnel(pool, stages)
    elif funnel_name == "service-request": 
        return await _query_event_log(pool, "service_request", stages)
    elif funnel_name == "account-creation": 
        return await _query_event_log(pool, "citizen", stages)
    elif funnel_name in ["flight_departure", "passenger"]: 
        return await _query_entity_event_funnel(pool, funnel_name, stages)
    else:
        return await _query_entity_event_funnel(pool, funnel_name, stages)

async def _query_event_log(pool, entity_type: str, stages: list[str]) -> list[dict]:
    result = []
    async with pool.acquire() as conn:
        for stage in stages:
            count = await safe_fetchval(conn, 
                "SELECT COUNT(DISTINCT ee.entity_id) FROM entities.entity_event ee "
                "JOIN entities.entity e ON e.id = ee.entity_id "
                "WHERE ee.entity_type = $1 AND ee.event_type = $2 "
                "AND e.created_at >= NOW() - ($3 || ' hours')::INTERVAL", 
                entity_type, stage, WINDOW_HOURS)
            result.append({"stage": stage, "count": int(count)})
    return result

async def _query_iot_incident_funnel(pool, stages: list[str]) -> list[dict]:
    async with pool.acquire() as conn:
        anomalies = await safe_fetchval(conn, 
            "SELECT COUNT(*) FROM iot.anomalies WHERE detected_at >= NOW() - ($1 || ' hours')::INTERVAL", 
            WINDOW_HOURS)
        incidents = await safe_fetchval(conn, 
            "SELECT COUNT(*) FROM entities.entity_event WHERE entity_type = 'incident' "
            "AND event_type = 'incident.detecting' AND occurred_at >= NOW() - ($1 || ' hours')::INTERVAL", 
            WINDOW_HOURS)
        
        wo_counts = []
        wo_event_types = ["work_order.created", "work_order.assigned", "work_order.acknowledged", "work_order.resolved"]
        
        for event_type in wo_event_types:
            count = await safe_fetchval(conn, 
                "SELECT COUNT(DISTINCT ee.entity_id) FROM entities.entity_event ee "
                "JOIN entities.entity e ON e.id = ee.entity_id "
                "WHERE ee.entity_type = 'work_order' AND ee.event_type = $1 "
                "AND e.links->>'incident_id' IS NOT NULL AND ee.occurred_at >= NOW() - ($2 || ' hours')::INTERVAL", 
                event_type, WINDOW_HOURS)
            wo_counts.append(count)
        
        counts = [anomalies, incidents] + wo_counts
        return [{"stage": stage, "count": int(count)} for stage, count in zip(stages, counts)]

async def _query_entity_event_funnel(pool, entity_type: str, stages: list[str]) -> list[dict]:
    result = []
    async with pool.acquire() as conn:
        for stage in stages:
            count = await safe_fetchval(conn, 
                "SELECT COUNT(DISTINCT entity_id) FROM entities.entity_event "
                "WHERE entity_type = $1 AND event_type = $2 "
                "AND occurred_at >= NOW() - ($3 || ' hours')::INTERVAL", 
                entity_type, stage, WINDOW_HOURS)
            result.append({"stage": stage, "count": int(count)})
    return result

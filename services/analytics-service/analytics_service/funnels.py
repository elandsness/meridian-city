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
    """
    def __contains__(self, item):
        try:
            import asyncio
            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    return False 
                return loop.run_until_complete(load_funnel_definitions())
            except RuntimeError:
                return asyncio.run(load_funnel_definitions())
        except Exception:
            return False

    def __repr__(self):
        return "DynamicFunnelList()"

FUNNEL_NAMES = DynamicFunnelList()

async def load_funnel_definitions() -> dict[str, dict]:
    """
    Derives funnel definitions from the industry config.
    Priority: 
    1. Root 'flows' section (explicit overrides).
    2. Derived from 'entities' sequence.
    """
    try:
        if os.path.exists(CONFIG_PATH):
            with open(CONFIG_PATH, 'r') as f:
                config = json.load(f)
                
                # 1. Explicit flows override
                flows_config = config.get("flows", {})
                if flows_config:
                    return flows_config
                
                # 2. Derive from entities
                entities = config.get("entities", {})
                derived_flows = {}
                for entity_type, defn in entities.items():
                    sequence = defn.get("sequence")
                    if sequence and isinstance(sequence, list):
                        derived_flows[entity_type] = {
                            "entityType": entity_type,
                            "stages": sequence
                        }
                return derived_flows
    except Exception as e:
        logger.error(f"Failed to load business flow definitions: {e}")
    
    return {}

async def get_funnel(funnel_name: str) -> List[dict]:
    funnels = await load_funnel_definitions()
    funnel_def = funnels.get(funnel_name)
    if not funnel_def: return []
    
    entity_type = funnel_def["entityType"]
    stages = funnel_def["stages"]
    
    pool = await get_pool()
    return await _query_entity_event_funnel(pool, entity_type, stages)

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

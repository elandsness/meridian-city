"""
KPI computation for analytics-service.
Derived from the Generic Entity Engine configuration.
"""
from __future__ import annotations
import logging
import os
import json
from datetime import datetime, timezone
from .db import get_pool, safe_fetchval
from .fault import fault_state

logger = logging.getLogger(__name__)
CONFIG_PATH = os.getenv("INDUSTRY_CONFIG_PATH", "/etc/config/config.json")

def load_industry_config() -> dict:
    try:
        if os.path.exists(CONFIG_PATH):
            with open(CONFIG_PATH, 'r') as f:
                return json.load(f)
    except Exception as e:
        logger.error(f"Failed to load industry config: {e}")
    return {}

def get_states_by_property(entity_type: str, property_name: str, value: Any = True) -> list[str]:
    """Returns a list of state IDs for an entity that match a specific property (e.g., terminal=True)."""
    config = load_industry_config()
    entities = config.get("entities", {})
    entity_def = entities.get(entity_type, {})
    states = entity_def.get("states", {})
    
    return [s_id for s_id, s_def in states.items() if s_def.get(property_name) == value]

async def compute_kpis() -> dict:
    """Return a fresh KPI snapshot dict, driven by industry configuration."""
    await fault_state.maybe_delay()
    
    # Derive the state lists from the config
    # For requests: terminal = resolved/closed
    request_resolved_states = get_states_by_property("service_request", "terminal")
    # For incidents: terminal = resolved/closed
    incident_resolved_states = get_states_by_property("incident", "terminal")
    
    pool = await get_pool()
    async with pool.acquire() as conn:
        # 1. Requests Today
        requests_today = await safe_fetchval(conn, """
            SELECT COUNT(*) FROM entities.entity
            WHERE entity_type = 'service_request'
              AND created_at >= CURRENT_DATE
        """)

        # 2. Requests Open (NOT terminal)
        # Construct: state NOT IN ('...', '...')
        resolved_list = tuple(request_resolved_states) if request_resolved_states else ("'NONE'",)
        requests_open = await safe_fetchval(conn, f"""
            SELECT COUNT(*) FROM entities.entity
            WHERE entity_type = 'service_request'
              AND state NOT IN {resolved_list}
        """)

        # 3. Requests Resolved Today
        resolved_list_str = ",".join([f"'{s}'" for s in request_resolved_states]) if request_resolved_states else "''"
        requests_resolved_today = await safe_fetchval(conn, f"""
            SELECT COUNT(*) FROM entities.entity
            WHERE entity_type = 'service_request'
              AND state IN ({resolved_list_str})
              AND updated_at >= CURRENT_DATE
        """)

        # 4. Incidents Open (NOT terminal)
        inc_resolved_list = tuple(incident_resolved_states) if incident_resolved_states else ("'NONE'",)
        incidents_open = await safe_fetchval(conn, f"""
            SELECT COUNT(*) FROM entities.entity
            WHERE entity_type = 'incident'
              AND state NOT IN {inc_resolved_list}
        """)

        # 5. IoT Anomalies (Incidents with source='iot' created in 24h)
        # Note: We assume 'source' is a field in the entity table for incidents.
        iot_anomalies_24h = await safe_fetchval(conn, """
            SELECT COUNT(*) FROM entities.entity
            WHERE entity_type = 'incident'
              AND (links->>'source' = 'iot' OR source = 'iot')
              AND created_at >= NOW() - INTERVAL '24 hours'
        """)

        # 6. Avg Resolution Time (Last 30 days)
        # Based on entities that reached a terminal state
        avg_resolution_minutes_raw = await safe_fetchval(conn, f"""
            SELECT COALESCE(
                EXTRACT(EPOCH FROM AVG(updated_at - created_at)) / 60,
                0
            )
            FROM entities.entity
            WHERE entity_type = 'service_request'
              AND state IN ({resolved_list_str})
              AND updated_at >= NOW() - INTERVAL '30 days'
        """, default=0.0)

        # 7. AI Chats Today
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
        "avg_resolution_hours": round(avg_minutes / 60, 2),
        "ai_chats_today": int(ai_chats_today),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

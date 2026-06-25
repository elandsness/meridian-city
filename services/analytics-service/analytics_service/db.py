"""
PostgreSQL access for analytics-service.

Owns the `analytics` schema:
  - kpi_snapshots   — periodic KPI snapshots (5-min intervals)

Also reads (with safe fallbacks) from other schemas created by other services:
  - requests.service_requests
  - requests.request_events
  - incidents.incidents      (IoT anomalies = rows with source='iot')
  - incidents.work_orders
  - ai.chat_messages          (written by ai-service)
  - citizens.accounts
"""
from __future__ import annotations

import logging
import os
from typing import Optional

import asyncpg

logger = logging.getLogger(__name__)

_pool: Optional[asyncpg.Pool] = None


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            host=os.getenv("DB_HOST", "postgresql"),
            port=int(os.getenv("DB_PORT", "5432")),
            database=os.getenv("DB_NAME", "meridian"),
            user=os.getenv("DB_USER", "meridian"),
            password=os.getenv("DB_PASSWORD", "meridian"),
            min_size=2,
            max_size=10,
        )
    return _pool


async def init_db() -> None:
    """Create the analytics schema and tables if they don't exist."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute("CREATE SCHEMA IF NOT EXISTS analytics")

        await conn.execute("""
            CREATE TABLE IF NOT EXISTS analytics.kpi_snapshots (
                id                      BIGSERIAL PRIMARY KEY,
                snapshot_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                requests_today          INTEGER DEFAULT 0,
                requests_open           INTEGER DEFAULT 0,
                requests_resolved_today INTEGER DEFAULT 0,
                incidents_open          INTEGER DEFAULT 0,
                iot_anomalies_24h       INTEGER DEFAULT 0,
                avg_resolution_hours    FLOAT DEFAULT 0.0
            )
        """)

        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_kpi_snapshots_at
                ON analytics.kpi_snapshots (snapshot_at)
        """)

    logger.info("analytics schema initialised")


async def safe_fetchval(conn, query: str, *args, default=0):
    """Execute a scalar query, returning `default` on any error (e.g. table missing)."""
    try:
        result = await conn.fetchval(query, *args)
        return result if result is not None else default
    except Exception as exc:
        logger.debug("safe_fetchval fallback for query: %s — %s", query[:60], exc)
        return default


async def save_kpi_snapshot(snapshot: dict) -> None:
    """Persist a KPI snapshot row. Non-fatal if it fails."""
    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            await conn.execute("""
                INSERT INTO analytics.kpi_snapshots
                    (requests_today, requests_open, requests_resolved_today,
                     incidents_open, iot_anomalies_24h, avg_resolution_hours)
                VALUES ($1, $2, $3, $4, $5, $6)
            """,
                snapshot["requests_today"],
                snapshot["requests_open"],
                snapshot["requests_resolved_today"],
                snapshot["incidents_open"],
                snapshot["iot_anomalies_24h"],
                snapshot["avg_resolution_hours"],
            )
    except Exception as exc:
        logger.debug("kpi snapshot save failed (non-fatal): %s", exc)


async def load_kpi_history(hours: int = 24) -> list[dict]:
    """Return recent KPI snapshots from the DB (most recent first)."""
    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch("""
                SELECT snapshot_at, requests_today, requests_open, requests_resolved_today,
                       incidents_open, iot_anomalies_24h, avg_resolution_hours
                FROM analytics.kpi_snapshots
                WHERE snapshot_at >= NOW() - ($1 || ' hours')::INTERVAL
                ORDER BY snapshot_at DESC
                LIMIT 288
            """, str(hours))
            return [dict(r) for r in rows]
    except Exception as exc:
        logger.debug("kpi history load failed (non-fatal): %s", exc)
        return []


async def close() -> None:
    global _pool
    if _pool:
        await _pool.close()
        _pool = None
    logger.info("DB pool closed")

"""
PostgreSQL access for the telemetry-processor.

Owns the `iot` schema: device_readings (1-min aggregates) and anomalies.
Uses asyncpg for async I/O.
"""
import asyncpg
import logging
import os
from typing import Optional

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
    """Create the iot schema and tables if they don't exist."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute("CREATE SCHEMA IF NOT EXISTS iot")

        await conn.execute("""
            CREATE TABLE IF NOT EXISTS iot.device_readings (
                id          BIGSERIAL PRIMARY KEY,
                device_id   VARCHAR(50)  NOT NULL,
                device_type VARCHAR(50),
                zone        VARCHAR(50),
                window_start TIMESTAMPTZ NOT NULL,
                window_end   TIMESTAMPTZ NOT NULL,
                metric_name  VARCHAR(100) NOT NULL,
                min_value    DOUBLE PRECISION,
                max_value    DOUBLE PRECISION,
                avg_value    DOUBLE PRECISION,
                sample_count INTEGER,
                created_at   TIMESTAMPTZ DEFAULT NOW()
            )
        """)

        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_device_readings_device_time
                ON iot.device_readings (device_id, window_start)
        """)

        await conn.execute("""
            CREATE TABLE IF NOT EXISTS iot.anomalies (
                id           BIGSERIAL PRIMARY KEY,
                device_id    VARCHAR(50)  NOT NULL,
                anomaly_type VARCHAR(100) NOT NULL,
                metric_name  VARCHAR(100),
                value        DOUBLE PRECISION,
                threshold    DOUBLE PRECISION,
                severity     VARCHAR(20) DEFAULT 'warning',
                detected_at  TIMESTAMPTZ DEFAULT NOW(),
                resolved_at  TIMESTAMPTZ,
                status       VARCHAR(20) DEFAULT 'active'
            )
        """)

    logger.info("iot schema initialised")


async def store_device_reading(window: dict) -> None:
    """Persist a 1-minute aggregate window."""
    pool = await get_pool()
    import datetime
    async with pool.acquire() as conn:
        await conn.execute("""
            INSERT INTO iot.device_readings
                (device_id, device_type, zone, window_start, window_end,
                 metric_name, min_value, max_value, avg_value, sample_count)
            VALUES ($1, $2, $3,
                    to_timestamp($4), to_timestamp($5),
                    $6, $7, $8, $9, $10)
        """,
            window["device_id"],
            window.get("device_type", ""),
            window.get("zone", ""),
            window["window_start"],
            window["window_end"],
            window["metric_name"],
            window["min"],
            window["max"],
            window["avg"],
            window["count"],
        )


async def store_anomaly(anomaly: dict) -> int:
    """Persist a detected anomaly and return its generated ID."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow("""
            INSERT INTO iot.anomalies
                (device_id, anomaly_type, metric_name, value, threshold, severity)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id
        """,
            anomaly["device_id"],
            anomaly.get("anomaly_type", anomaly.get("metric_name", "")),
            anomaly.get("metric_name", ""),
            anomaly.get("avg_value", 0.0),
            anomaly.get("threshold", 0.0),
            "warning",
        )
        return row["id"]


async def close() -> None:
    global _pool
    if _pool:
        await _pool.close()
        _pool = None
    logger.info("DB pool closed")

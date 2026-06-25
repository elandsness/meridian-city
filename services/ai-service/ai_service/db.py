"""
PostgreSQL access for ai-service — owns the `ai` schema.

  ai.chat_messages — one row per chatbot interaction, so analytics-service can
                     count "AI chats today" on the ops dashboard.

Everything here is BEST-EFFORT: the chatbot must never fail or slow down because
the database is unavailable. init_db() and record_chat() swallow all errors; if
the DB is down the chat still works and the count simply stays at 0.

DB connection details come from the standard meridian.commonEnv vars injected
into every service (DB_HOST / DB_PORT / DB_NAME / DB_USER / DB_PASSWORD).
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
            min_size=1,
            max_size=5,
            timeout=10,
        )
    return _pool


async def init_db() -> None:
    """Create the `ai` schema + chat_messages table if absent. Non-fatal."""
    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            await conn.execute("CREATE SCHEMA IF NOT EXISTS ai")
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS ai.chat_messages (
                    id            BIGSERIAL PRIMARY KEY,
                    session_id    VARCHAR,
                    model         VARCHAR,
                    input_tokens  INTEGER DEFAULT 0,
                    output_tokens INTEGER DEFAULT 0,
                    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            """)
            await conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at
                    ON ai.chat_messages (created_at)
            """)
        logger.info("ai schema initialised")
    except Exception as exc:
        logger.warning("ai DB init failed — chat counting disabled, chat unaffected: %s", exc)


async def record_chat(session_id: str, model: str,
                      input_tokens: int = 0, output_tokens: int = 0) -> None:
    """Persist one chat interaction. Best-effort — never raises."""
    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO ai.chat_messages (session_id, model, input_tokens, output_tokens)
                VALUES ($1, $2, $3, $4)
                """,
                session_id, model, int(input_tokens or 0), int(output_tokens or 0),
            )
    except Exception as exc:
        logger.debug("record_chat failed (non-fatal): %s", exc)


async def close() -> None:
    global _pool
    if _pool:
        await _pool.close()
        _pool = None
    logger.info("ai DB pool closed")

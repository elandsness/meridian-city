"""
Fault injection state for ai-service.

Supports:
  llm_latency_enabled  — inject artificial sleep before each LLM call
  llm_latency_seconds  — how long to sleep (default: 10s when enabled)

The FaultState singleton is loaded once at startup from env vars and can be
updated at runtime via POST /admin/fault.
"""
from __future__ import annotations

import asyncio
import logging

logger = logging.getLogger(__name__)


class FaultState:
    def __init__(self) -> None:
        self.llm_latency_enabled: bool = False
        self.llm_latency_seconds: float = 0.0

    async def maybe_delay(self) -> None:
        """Sleep before an LLM call if latency injection is active."""
        if self.llm_latency_enabled and self.llm_latency_seconds > 0:
            logger.warning(
                "fault injection: artificial LLM latency active",
                extra={"latency_seconds": self.llm_latency_seconds},
            )
            await asyncio.sleep(self.llm_latency_seconds)


# Module-level singleton — shared by api.py and chat.py
fault_state = FaultState()

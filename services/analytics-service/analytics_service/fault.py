"""
Fault injection state for analytics-service.

Supports:
  db_slowdown_enabled   — inject artificial sleep before DB queries
  db_slowdown_seconds   — duration of the sleep (default: 2s when enabled)
  memory_pressure_enabled — allocate large in-memory buffers (simulated memory leak)

Toggled at runtime via POST /admin/fault.
Seeded from env vars at startup.
"""
from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from typing import List

logger = logging.getLogger(__name__)


@dataclass
class FaultState:
    db_slowdown_enabled: bool = False
    db_slowdown_seconds: float = 0.0
    memory_pressure_enabled: bool = False

    # Internal buffer — holds onto memory when memory_pressure is on
    _memory_hog: List[bytearray] = field(default_factory=list, repr=False)

    async def maybe_delay(self) -> None:
        """Sleep before a DB query if slowdown injection is active."""
        if self.db_slowdown_enabled and self.db_slowdown_seconds > 0:
            logger.warning(
                "fault injection: artificial DB slowdown active",
                extra={"slowdown_seconds": self.db_slowdown_seconds},
            )
            await asyncio.sleep(self.db_slowdown_seconds)

    def apply_memory_pressure(self) -> None:
        """Allocate ~100 MB blocks (up to 1 GB total) when enabled."""
        if self.memory_pressure_enabled and len(self._memory_hog) < 10:
            self._memory_hog.append(bytearray(100 * 1024 * 1024))
            logger.warning(
                "fault injection: memory pressure block allocated",
                extra={"blocks": len(self._memory_hog)},
            )

    def release_memory_pressure(self) -> None:
        """Free all allocated buffers."""
        self._memory_hog.clear()
        logger.info("fault injection: memory pressure released")


# Module-level singleton — shared by api.py and kpis.py
fault_state = FaultState()

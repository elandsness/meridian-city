"""
Fault injection state for analytics-service.

Supports:
  db_slowdown_enabled   — inject artificial sleep before DB queries
  db_slowdown_seconds   — duration of the sleep (default: 2s when enabled)
  memory_pressure_enabled — leak memory over time (simulated memory leak)

Toggled at runtime via POST /admin/fault.
Seeded from env vars at startup.

Memory pressure runs as a background asyncio task: once enabled it allocates a
fresh block every MEMORY_LEAK_INTERVAL_SECONDS so the container's working set
*rises steadily* toward the limit (a single up-front allocation used to leave it
flat). Growth stops the moment the fault is disabled, and reset frees everything.
The defaults are sized to approach (and overshoot) a 512Mi container limit in a
couple of minutes, producing a clear rising curve and an OOMKill on clusters that
enforce limits. All three knobs are env-overridable for tuning per cluster.
"""
from __future__ import annotations

import asyncio
import logging
import os
from dataclasses import dataclass, field
from typing import List, Optional

logger = logging.getLogger(__name__)

# Size of each allocation block (MB).
MEMORY_LEAK_BLOCK_MB = int(os.getenv("FAULT_MEMORY_LEAK_BLOCK_MB", "32"))
# How often the background loop allocates another block (seconds).
MEMORY_LEAK_INTERVAL_SECONDS = float(os.getenv("FAULT_MEMORY_LEAK_INTERVAL_SECONDS", "20"))
# Hard ceiling on total allocation (MB) — a guardrail for clusters that do NOT
# enforce memory limits, so the leak can't take down the node. On enforced
# clusters an OOMKill fires well before this is reached.
MEMORY_LEAK_MAX_MB = int(os.getenv("FAULT_MEMORY_LEAK_MAX_MB", "768"))


@dataclass
class FaultState:
    db_slowdown_enabled: bool = False
    db_slowdown_seconds: float = 0.0
    memory_pressure_enabled: bool = False

    # Internal buffer — holds onto memory while memory_pressure is on.
    _memory_hog: List[bytearray] = field(default_factory=list, repr=False)
    # Background task that grows _memory_hog over time while the fault is on.
    _leak_task: Optional[asyncio.Task] = field(default=None, repr=False)

    @property
    def _max_blocks(self) -> int:
        return max(1, MEMORY_LEAK_MAX_MB // MEMORY_LEAK_BLOCK_MB)

    async def maybe_delay(self) -> None:
        """Sleep before a DB query if slowdown injection is active."""
        if self.db_slowdown_enabled and self.db_slowdown_seconds > 0:
            logger.warning(
                "fault injection: artificial DB slowdown active",
                extra={"slowdown_seconds": self.db_slowdown_seconds},
            )
            await asyncio.sleep(self.db_slowdown_seconds)

    def apply_memory_pressure(self) -> None:
        """Allocate one block, up to the configured ceiling, when enabled."""
        if self.memory_pressure_enabled and len(self._memory_hog) < self._max_blocks:
            self._memory_hog.append(bytearray(MEMORY_LEAK_BLOCK_MB * 1024 * 1024))
            logger.warning(
                "fault injection: memory pressure block allocated",
                extra={
                    "blocks": len(self._memory_hog),
                    "allocated_mb": len(self._memory_hog) * MEMORY_LEAK_BLOCK_MB,
                },
            )

    def start_memory_leak(self) -> None:
        """Begin growing memory in the background until disabled or the cap is hit.

        Allocates the first block immediately, then one block every
        MEMORY_LEAK_INTERVAL_SECONDS. Idempotent — calling it while a leak is
        already running is a no-op. Must be called from within a running event
        loop (the FastAPI handler / startup hook).
        """
        if self._leak_task is not None and not self._leak_task.done():
            return
        self._leak_task = asyncio.create_task(self._leak_loop())

    def stop_memory_leak(self) -> None:
        """Cancel the background growth loop (does not free already-held memory)."""
        if self._leak_task is not None:
            self._leak_task.cancel()
            self._leak_task = None

    async def _leak_loop(self) -> None:
        """Allocate a block on a timer until disabled or the ceiling is reached."""
        try:
            while self.memory_pressure_enabled and len(self._memory_hog) < self._max_blocks:
                self.apply_memory_pressure()
                await asyncio.sleep(MEMORY_LEAK_INTERVAL_SECONDS)
            logger.warning(
                "fault injection: memory leak loop finished",
                extra={
                    "blocks": len(self._memory_hog),
                    "enabled": self.memory_pressure_enabled,
                },
            )
        except asyncio.CancelledError:
            raise

    def release_memory_pressure(self) -> None:
        """Stop further growth and free all allocated buffers."""
        self.stop_memory_leak()
        self._memory_hog.clear()
        logger.info("fault injection: memory pressure released")


# Module-level singleton — shared by api.py and kpis.py
fault_state = FaultState()

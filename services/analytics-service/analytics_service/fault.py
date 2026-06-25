"""
Fault injection state for analytics-service.

Supports:
  db_slowdown_enabled          — inject artificial sleep before DB queries
  db_slowdown_seconds          — duration of the sleep (default: 2s when enabled)
  memory_pressure_enabled      — leak memory over time (simulated memory leak)
  memory_pressure_cap_mb       — total-allocation ceiling for the leak (default: 768)
  memory_pressure_ramp_seconds — time to grow from ~0 to the cap (default: 300)

Toggled at runtime via POST /admin/fault. Seeded from env vars at startup.

Memory pressure runs as a background asyncio task: once enabled it allocates a
chunk every MEMORY_LEAK_INTERVAL_SECONDS so the container's working set *rises
steadily* up to `memory_pressure_cap_mb`, reaching it in about
`memory_pressure_ramp_seconds`. The per-tick chunk size is derived from cap and
ramp, so the same cap reached over a shorter ramp simply grows faster. When the
cap is set above the container memory limit the working set overshoots it and the
kernel OOMKills the container partway up the ramp — the app does not need to know
its own limit. Growth stops the moment the fault is disabled, and reset frees
everything. Both knobs are adjustable per-activation; the defaults are
env-overridable for tuning per cluster.
"""
from __future__ import annotations

import asyncio
import logging
import os
from dataclasses import dataclass, field
from typing import List, Optional

logger = logging.getLogger(__name__)

# How often the background loop allocates another chunk (seconds). Smaller =
# smoother rising curve; the chunk size scales to keep the ramp duration fixed.
MEMORY_LEAK_INTERVAL_SECONDS = float(os.getenv("FAULT_MEMORY_LEAK_INTERVAL_SECONDS", "20"))
# Default total-allocation ceiling (MB). A guardrail for clusters that do NOT
# enforce memory limits; on enforced clusters an OOMKill fires once the working
# set crosses the limit (before the cap is reached, when the cap is set above it).
MEMORY_LEAK_MAX_MB = int(os.getenv("FAULT_MEMORY_LEAK_MAX_MB", "768"))
# Default time to grow from ~0 to the cap (seconds).
MEMORY_LEAK_RAMP_SECONDS = int(os.getenv("FAULT_MEMORY_LEAK_RAMP_SECONDS", "300"))


@dataclass
class FaultState:
    db_slowdown_enabled: bool = False
    db_slowdown_seconds: float = 0.0
    memory_pressure_enabled: bool = False
    # Total-allocation ceiling (MB) — how HIGH the leak grows. Above the container
    # memory limit => OOMKill; below => plateau (stress without a kill).
    memory_pressure_cap_mb: int = MEMORY_LEAK_MAX_MB
    # Time to grow from ~0 to the cap (seconds) — how FAST it gets there.
    memory_pressure_ramp_seconds: int = MEMORY_LEAK_RAMP_SECONDS

    # Internal buffer — holds onto memory while memory_pressure is on.
    _memory_hog: List[bytearray] = field(default_factory=list, repr=False)
    # MB allocated so far this run (tracks progress toward the cap).
    _allocated_mb: int = field(default=0, repr=False)
    # Background task that grows _memory_hog over time while the fault is on.
    _leak_task: Optional[asyncio.Task] = field(default=None, repr=False)

    @property
    def _per_tick_mb(self) -> int:
        """MB to allocate per tick so the cap is reached in ~ramp seconds."""
        ticks = max(1.0, self.memory_pressure_ramp_seconds / MEMORY_LEAK_INTERVAL_SECONDS)
        return max(1, round(self.memory_pressure_cap_mb / ticks))

    async def maybe_delay(self) -> None:
        """Sleep before a DB query if slowdown injection is active."""
        if self.db_slowdown_enabled and self.db_slowdown_seconds > 0:
            logger.warning(
                "fault injection: artificial DB slowdown active",
                extra={"slowdown_seconds": self.db_slowdown_seconds},
            )
            await asyncio.sleep(self.db_slowdown_seconds)

    def apply_memory_pressure(self) -> None:
        """Allocate the next chunk, up to the configured cap, when enabled."""
        if self.memory_pressure_enabled and self._allocated_mb < self.memory_pressure_cap_mb:
            chunk = min(self._per_tick_mb, self.memory_pressure_cap_mb - self._allocated_mb)
            self._memory_hog.append(bytearray(chunk * 1024 * 1024))
            self._allocated_mb += chunk
            logger.warning(
                "fault injection: memory pressure chunk allocated",
                extra={
                    "allocated_mb": self._allocated_mb,
                    "cap_mb": self.memory_pressure_cap_mb,
                    "chunk_mb": chunk,
                },
            )

    def start_memory_leak(self) -> None:
        """Begin growing memory in the background until disabled or the cap is hit.

        Allocates the first chunk immediately, then one chunk every
        MEMORY_LEAK_INTERVAL_SECONDS. Idempotent while running; if a previous loop
        already finished (cap reached) this starts a fresh one — so raising the cap
        or shortening the ramp at runtime resumes growth. Must be called from
        within a running event loop (the FastAPI handler / startup hook).
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
        """Allocate a chunk on a timer until disabled or the cap is reached."""
        try:
            while self.memory_pressure_enabled and self._allocated_mb < self.memory_pressure_cap_mb:
                self.apply_memory_pressure()
                await asyncio.sleep(MEMORY_LEAK_INTERVAL_SECONDS)
            logger.warning(
                "fault injection: memory leak loop finished",
                extra={
                    "allocated_mb": self._allocated_mb,
                    "enabled": self.memory_pressure_enabled,
                },
            )
        except asyncio.CancelledError:
            raise

    def release_memory_pressure(self) -> None:
        """Stop further growth and free all allocated buffers."""
        self.stop_memory_leak()
        self._memory_hog.clear()
        self._allocated_mb = 0
        logger.info("fault injection: memory pressure released")


# Module-level singleton — shared by api.py and kpis.py
fault_state = FaultState()

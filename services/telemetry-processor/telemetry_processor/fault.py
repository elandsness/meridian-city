"""
Mutable fault-injection state for the telemetry-processor.

Flags are toggled at runtime via POST /admin/fault.
"""
from dataclasses import dataclass, field
from typing import List


@dataclass
class FaultState:
    # Pause Kafka consumption — simulates consumer group lag
    kafka_pause_enabled: bool = False

    # Allocate large in-memory buffers — simulates a memory leak
    memory_pressure_enabled: bool = False

    # Internal buffer — holds onto memory when memory_pressure is on
    _memory_hog: List[bytearray] = field(default_factory=list, repr=False)

    def apply_memory_pressure(self) -> None:
        """Allocate ~100 MB blocks (up to 1 GB total) when enabled."""
        if self.memory_pressure_enabled and len(self._memory_hog) < 10:
            self._memory_hog.append(bytearray(100 * 1024 * 1024))

    def release_memory_pressure(self) -> None:
        """Free all allocated buffers."""
        self._memory_hog.clear()


# Module-level singleton — all components share this instance
fault_state = FaultState()

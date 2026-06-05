"""
1-minute sliding window aggregator for IoT device metrics.

Accumulates raw readings per (device_id, metric_name) window.
After the window_seconds interval elapses, flush_completed_windows()
returns the aggregated results (min/max/avg/count) and resets that window.
"""
import asyncio
import time
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Dict, List, Tuple


@dataclass
class MetricWindow:
    samples: List[float] = field(default_factory=list)
    window_start: float = field(default_factory=time.time)
    device_type: str = ""
    zone: str = ""

    @property
    def min(self) -> float:
        return min(self.samples) if self.samples else 0.0

    @property
    def max(self) -> float:
        return max(self.samples) if self.samples else 0.0

    @property
    def avg(self) -> float:
        return sum(self.samples) / len(self.samples) if self.samples else 0.0

    @property
    def count(self) -> int:
        return len(self.samples)


class Aggregator:
    """
    Thread-safe (asyncio-safe) aggregator. Uses an asyncio.Lock to protect
    the in-memory window map.
    """

    def __init__(self, window_seconds: int = 60):
        self.window_seconds = window_seconds
        # {device_id: {metric_name: MetricWindow}}
        self._windows: Dict[str, Dict[str, MetricWindow]] = defaultdict(
            lambda: defaultdict(MetricWindow)
        )
        self._lock = asyncio.Lock()

    async def record(
        self,
        device_id: str,
        metrics: Dict[str, float],
        device_type: str = "",
        zone: str = "",
    ) -> None:
        """Add a set of metric readings for a device to the current window."""
        async with self._lock:
            for metric_name, value in metrics.items():
                w = self._windows[device_id][metric_name]
                w.samples.append(value)
                w.device_type = device_type
                w.zone = zone

    async def flush_completed_windows(self) -> List[dict]:
        """
        Returns aggregated data for all windows that have elapsed their
        window_seconds duration, and resets those windows.
        """
        now = time.time()
        completed: List[dict] = []
        to_remove: List[Tuple[str, str]] = []

        async with self._lock:
            for device_id, metrics in list(self._windows.items()):
                for metric_name, window in list(metrics.items()):
                    if (
                        now - window.window_start >= self.window_seconds
                        and window.samples
                    ):
                        completed.append({
                            "device_id": device_id,
                            "device_type": window.device_type,
                            "zone": window.zone,
                            "metric_name": metric_name,
                            "window_start": window.window_start,
                            "window_end": now,
                            "min": window.min,
                            "max": window.max,
                            "avg": window.avg,
                            "count": window.count,
                        })
                        to_remove.append((device_id, metric_name))

            for device_id, metric_name in to_remove:
                del self._windows[device_id][metric_name]
                if not self._windows[device_id]:
                    del self._windows[device_id]

        return completed

    async def current_device_count(self) -> int:
        async with self._lock:
            return len(self._windows)

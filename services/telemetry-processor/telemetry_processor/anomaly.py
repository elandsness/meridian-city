"""
Threshold-based anomaly detector for IoT device metrics.

Rules are defined per (device_category, metric_name). A violation is only
promoted to an anomaly after N consecutive 1-minute windows exceed the
threshold — this prevents false positives from single spikes.
"""
from collections import defaultdict
from typing import Dict, Optional, Tuple

# ---------------------------------------------------------------------------
# Threshold rules
# Format: {category: {metric_name: {threshold, operator, consecutive}}}
# ---------------------------------------------------------------------------
THRESHOLDS: Dict[str, Dict[str, dict]] = {
    "building": {
        "iot.building.hvac_temp": {
            "threshold": 85.0,
            "operator": ">",
            "consecutive": 3,
            "description": "HVAC overtemperature",
        },
        "iot.building.co2_ppm": {
            "threshold": 1000.0,
            "operator": ">",
            "consecutive": 2,
            "description": "High CO2 level",
        },
    },
    "vehicle": {
        "iot.vehicle.engine_temp": {
            "threshold": 110.0,
            "operator": ">",
            "consecutive": 1,
            "description": "Engine overtemperature",
        },
        "iot.vehicle.speed": {
            "threshold": 120.0,
            "operator": ">",
            "consecutive": 1,
            "description": "Excessive speed",
        },
    },
    "machine": {
        "iot.machine.vibration": {
            "threshold": 8.0,
            "operator": ">",
            "consecutive": 1,
            "description": "High vibration",
        },
        "iot.machine.error_rate": {
            "threshold": 5.0,
            "operator": ">",
            "consecutive": 1,
            "description": "Elevated error rate",
        },
    },
}


class AnomalyDetector:
    """
    Stateful anomaly detector.

    Tracks consecutive violation counts per (device_id, metric_name) pair.
    Once a device's violation count reaches the rule's `consecutive` threshold,
    an anomaly is reported. Subsequent violations for the same key are
    suppressed (already-active anomaly) until the device recovers.
    """

    def __init__(self) -> None:
        # (device_id, metric_name) → consecutive violation count
        self._violation_counts: Dict[Tuple[str, str], int] = defaultdict(int)
        # (device_id, metric_name) → anomaly DB id (if active)
        self._active_anomalies: Dict[Tuple[str, str], int] = {}

    def check(
        self,
        device_id: str,
        device_category: str,
        metric_name: str,
        avg_value: float,
    ) -> Optional[dict]:
        """
        Evaluate a 1-minute average against the relevant threshold rule.

        Returns an anomaly dict if a new anomaly should be raised, else None.
        """
        rule = THRESHOLDS.get(device_category, {}).get(metric_name)
        if rule is None:
            return None

        key = (device_id, metric_name)
        threshold = rule["threshold"]
        operator = rule["operator"]
        consecutive_needed = rule["consecutive"]

        is_violation = (
            (operator == ">" and avg_value > threshold) or
            (operator == "<" and avg_value < threshold)
        )

        if not is_violation:
            # Recovery — reset counter and clear active anomaly marker
            self._violation_counts[key] = 0
            self._active_anomalies.pop(key, None)
            return None

        # Increment violation counter
        self._violation_counts[key] += 1

        # Don't re-raise if already active
        if key in self._active_anomalies:
            return None

        # Check if we've reached the consecutive threshold
        if self._violation_counts[key] >= consecutive_needed:
            return {
                "device_id": device_id,
                "device_category": device_category,
                "anomaly_type": rule["description"],
                "metric_name": metric_name,
                "avg_value": avg_value,
                "threshold": threshold,
                "consecutive_violations": self._violation_counts[key],
            }

        return None

    def mark_active(self, key: Tuple[str, str], anomaly_id: int) -> None:
        """Record that an anomaly has been persisted with the given DB id."""
        self._active_anomalies[key] = anomaly_id

    def active_anomaly_count(self) -> int:
        return len(self._active_anomalies)

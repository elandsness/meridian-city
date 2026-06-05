"""
Prometheus text-format metric serialiser for the analytics-service /metrics endpoint.

The Site Reliability Guardian (SRG) in Dynatrace scrapes this endpoint to evaluate
SLOs against business-level metrics.

Exposed metrics:
  meridian_service_requests_today        — requests submitted today
  meridian_service_requests_open         — currently open (unresolved) requests
  meridian_service_requests_resolved_today — requests resolved today
  meridian_incidents_open                — open incidents count
  meridian_iot_anomalies_24h             — IoT anomalies detected in last 24 h
  meridian_avg_resolution_hours          — mean time to resolve (last 30 days)
"""
from __future__ import annotations


def render(kpis: dict) -> str:
    """
    Serialise the KPI dict to Prometheus exposition format.
    Returns a UTF-8 string with a trailing newline.
    """
    lines: list[str] = []

    def gauge(name: str, help_text: str, value) -> None:
        lines.append(f"# HELP {name} {help_text}")
        lines.append(f"# TYPE {name} gauge")
        lines.append(f"{name} {value}")

    gauge(
        "meridian_service_requests_today",
        "Number of service requests submitted today",
        kpis.get("requests_today", 0),
    )
    gauge(
        "meridian_service_requests_open",
        "Number of service requests currently open (not resolved/closed/cancelled)",
        kpis.get("requests_open", 0),
    )
    gauge(
        "meridian_service_requests_resolved_today",
        "Number of service requests resolved today",
        kpis.get("requests_resolved_today", 0),
    )
    gauge(
        "meridian_incidents_open",
        "Number of open city incidents",
        kpis.get("incidents_open", 0),
    )
    gauge(
        "meridian_iot_anomalies_24h",
        "Number of IoT device anomalies detected in the last 24 hours",
        kpis.get("iot_anomalies_24h", 0),
    )
    gauge(
        "meridian_avg_resolution_hours",
        "Mean time to resolve service requests in hours (last 30 days)",
        kpis.get("avg_resolution_hours", 0.0),
    )

    return "\n".join(lines) + "\n"

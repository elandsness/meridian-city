#!/usr/bin/env python3
"""Provision Meridian City Dynatrace business-observability config.

Creates (idempotently, safe to re-run on every deploy):
  1. An OpenPipeline custom logs pipeline that parses the `BusinessEvents` JSON
     log lines and extracts them as business events (`event.provider = meridian.city`,
     `event.type` = the business event type) with all correlation fields carried over.
  2. A routing entry that sends Meridian `BusinessEvents` logs into that pipeline
     (merged into the single shared logs-routing object — never overwritten).
  3. Five Business Flows (one per /analytics business process) wired to the
     extracted bizevents on a single correlation id each.

Targets the Dynatrace Settings API via the modern platform endpoint with a
platform token. Matches existing objects by a stable key so re-runs update in
place rather than duplicating.

Env:
  DT_APPS_URL         e.g. https://<env>.apps.dynatrace.com   (required)
  DT_PLATFORM_TOKEN   dt0s16... with settings:objects:read/write, settings:schemas:read (required)
  DT_EVENT_PROVIDER   bizevent provider name (default: meridian.city)
  DT_LOG_NAMESPACE    k8s namespace the services run in (default: meridian)
"""
import json
import os
import sys
import urllib.error
import urllib.request
import uuid

APPS = os.environ["DT_APPS_URL"].rstrip("/")
TOKEN = os.environ["DT_PLATFORM_TOKEN"]
PROVIDER = os.environ.get("DT_EVENT_PROVIDER", "meridian.city")
NAMESPACE = os.environ.get("DT_LOG_NAMESPACE", "meridian")
BASE = APPS + "/platform/classic/environment-api/v2/settings"

# Shared-tenant marker: all Business Flow titles are prefixed so Meridian's flows
# are distinguishable from other teams' on the same Dynatrace tenant.
FLOW_TITLE_PREFIX = "[Meridian] "
PIPE_CUSTOM_ID = "meridian-business-events"
PIPE_NAME = "Meridian City — Business Events"
PIPELINE_SCHEMA = "builtin:openpipeline.logs.pipelines"
ROUTING_SCHEMA = "builtin:openpipeline.logs.routing"
FLOW_SCHEMA = "app:dynatrace.biz.flow:biz-flow-settings"

# Stable namespace for deterministic step UUIDs (so re-runs produce identical ids).
_NS = uuid.UUID("a1b2c3d4-e5f6-4000-8000-000000000001")


def api(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method)
    req.add_header("Authorization", "Bearer " + TOKEN)
    if data:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req) as r:
            raw = r.read().decode()
            return r.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except ValueError:
            return e.code, raw


def list_objects(schema):
    status, body = api("GET", "/objects?schemaIds=%s&fields=objectId,value&pageSize=500" % schema)
    if status != 200:
        sys.exit("FATAL: list %s failed: %s %s" % (schema, status, body))
    return body.get("items", [])


def upsert(schema, value, matches):
    """Create or update a settings object; `matches(value)` finds an existing one."""
    existing = next((o for o in list_objects(schema) if matches(o["value"])), None)
    if existing:
        status, body = api("PUT", "/objects/" + existing["objectId"], {"value": value})
        action, oid = "updated", existing["objectId"]
    else:
        status, body = api("POST", "/objects",
                           [{"schemaId": schema, "scope": "environment", "value": value}])
        action = "created"
        oid = body[0]["objectId"] if isinstance(body, list) and body and "objectId" in body[0] else None
    if status not in (200, 201):
        sys.exit("FATAL: %s %s failed: %s %s" % (action, schema, status, body))
    print("  %s: %s -> %s" % (action, schema.split(":")[-1], oid))
    return oid


# --------------------------------------------------------------------------- #
# 1. OpenPipeline logs pipeline (parse + bizevent extraction)
# --------------------------------------------------------------------------- #
DQL_SCRIPT = (
    'parse content, "JSON:bizjson"\n'
    "| fieldsAdd `meridian.event_type` = bizjson[`event.type`]\n"
    "| fieldsAdd `request.id` = bizjson[`request.id`], `citizen.id` = bizjson[`citizen.id`], "
    "`cart.id` = bizjson[`cart.id`], `order.id` = bizjson[`order.id`], `bill.id` = bizjson[`bill.id`], "
    "`work_order.id` = bizjson[`work_order.id`], `incident.id` = bizjson[`incident.id`], "
    "`asset.id` = bizjson[`asset.id`], `anomaly.type` = bizjson[`anomaly.type`], "
    "`assigned_department` = bizjson[`assigned_department`]\n"
    "| fieldsRemove bizjson"
)


def pipeline_value():
    empty = lambda: {"processors": []}
    return {
        "metadataList": [],
        "customId": PIPE_CUSTOM_ID,
        "displayName": PIPE_NAME,
        "processing": {"processors": [{
            "id": "processor_meridian_parse",
            "type": "dql",
            "matcher": "true",
            "description": "Parse Meridian BusinessEvents JSON log content into fields",
            "enabled": True,
            "dql": {"script": DQL_SCRIPT},
        }]},
        "securityContext": empty(),
        "costAllocation": empty(),
        "productAllocation": empty(),
        "storage": empty(),
        "smartscapeNodeExtraction": empty(),
        "smartscapeEdgeExtraction": empty(),
        "metricExtraction": empty(),
        "davis": empty(),
        "dataExtraction": {"processors": [{
            "id": "processor_meridian_bizevent",
            "type": "bizevent",
            "matcher": "isNotNull(`meridian.event_type`)",
            "description": "Extract Meridian business events from parsed BusinessEvents logs",
            "enabled": True,
            "bizevent": {
                "eventType": {"type": "field", "field": {"sourceFieldName": "meridian.event_type"}},
                "eventProvider": {"type": "constant", "constant": PROVIDER},
                "fieldExtraction": {"type": "includeAll"},
            },
        }]},
    }


def routing_entry(pipeline_object_id):
    matcher = ('matchesValue(k8s.namespace.name, "%s") AND '
               'matchesPhrase(content, "\\"logger_name\\":\\"BusinessEvents\\"")' % NAMESPACE)
    return {
        "enabled": True,
        "pipelineType": "custom",
        "pipelineId": pipeline_object_id,
        "matcher": matcher,
        "description": PIPE_NAME,
    }


# --------------------------------------------------------------------------- #
# 2. Business Flows — one per /analytics business process
# --------------------------------------------------------------------------- #
# Each step is (name, happy_event_type[, [error_event_type, ...]]). The optional third
# element lists business-exception event types attached to that step as isError events, so
# the flow renders an error branch + conversion drop-off at that step. These error events
# are emitted only when an SE turns on the matching demo-control scenario (default off), so
# the happy-path funnels stay clean otherwise. No DQL/pipeline change is needed: every error
# event carries a correlation id already surfaced by DQL_SCRIPT (request.id / citizen.id /
# work_order.id / incident.id / cart.id / order.id / bill.id) and auto-extracts as a bizevent
# via the includeAll + isNotNull(meridian.event_type) extraction.
FLOW_SPECS = [
    {"key": "service-request", "name": "Service Request Lifecycle", "correlationID": "request.id",
     "kpiLabel": "Resolved requests", "kpi": "request.id", "kpiCalculation": "lastEvent",
     "kpiEventName": "service_request.resolved",
     "steps": [("Submitted", "service_request.submitted"),
               ("Validated", "service_request.validated", ["service_request.rejected"]),
               ("Dispatched", "service_request.dispatched"), ("Assigned", "service_request.assigned"),
               ("In progress", "service_request.in_progress"), ("Resolved", "service_request.resolved")]},
    {"key": "account-creation", "name": "Account Creation", "correlationID": "citizen.id",
     "kpiLabel": "Activations", "kpi": "citizen.id", "kpiCalculation": "lastEvent",
     "kpiEventName": "account.activated",
     "steps": [("Registration started", "account.registration_started"),
               ("Details submitted", "account.details_submitted"),
               ("Verification sent", "account.verification_sent"),
               ("Verified", "account.verified", ["account.verification_failed"]),
               ("Activated", "account.activated", ["account.activation_failed"])]},
    {"key": "iot-incident", "name": "IoT Incident Resolution", "correlationID": "incident.id",
     "kpiLabel": "Resolved incidents", "kpi": "incident.id", "kpiCalculation": "lastEvent",
     "kpiEventName": "workorder.resolved",
     "steps": [("Anomaly detected", "iot.anomaly_detected"), ("Incident created", "incident.created"),
               ("Work order created", "workorder.created"), ("Work order assigned", "workorder.assigned"),
               ("Work order acknowledged", "workorder.acknowledged"),
               ("Work order resolved", "workorder.resolved", ["workorder.escalated"])]},
    {"key": "purchase", "name": "City Store Purchase", "correlationID": "cart.id",
     "kpiLabel": "Revenue", "kpi": "order.total_cents", "kpiCalculation": "sum",
     "kpiEventName": "checkout.completed",
     "steps": [("Item added", "cart.item_added"),
               ("Checkout completed", "checkout.completed", ["checkout.payment_declined"]),
               ("Order packed", "order.packed"), ("Order shipped", "order.shipped"),
               ("Order delivered", "order.delivered", ["order.delivery_failed"])]},
    {"key": "tax-payment", "name": "Tax Payment", "correlationID": "bill.id",
     "kpiLabel": "Tax collected", "kpi": "bill.amount_cents", "kpiCalculation": "sum",
     "kpiEventName": "tax.payment_completed",
     "steps": [("Bill issued", "tax.bill_issued"),
               ("Payment completed", "tax.payment_completed", ["tax.payment_failed"])]},
]


def _event(event_type, is_error=False):
    return {"id": "provider:%s-event:%s" % (PROVIDER, event_type), "name": event_type,
            "provider": PROVIDER, "isError": is_error, "isDisabled": False}


def flow_value(spec):
    steps, ids = [], []
    for i, step_spec in enumerate(spec["steps"]):
        name, event_type = step_spec[0], step_spec[1]
        error_types = step_spec[2] if len(step_spec) > 2 else []
        sid = str(uuid.uuid5(_NS, spec["key"] + "/" + name))
        ids.append(sid)
        events = [_event(event_type)] + [_event(et, is_error=True) for et in error_types]
        step = {"name": name, "id": sid, "events": events}
        if i == 0:
            step["isRoot"] = True
        steps.append(step)
    connections = [{"id": "%s__%s" % (a, b), "source": a, "target": b}
                   for a, b in zip(ids, ids[1:])]
    return {
        "name": FLOW_TITLE_PREFIX + spec["name"], "version": 1, "steps": steps, "connections": connections,
        "correlationID": spec["correlationID"], "analysisType": "conversion",
        "analysisCustomLabel": "Conversions", "isSmartscapeTopologyEnabled": False,
        "isDefaultQueryLimitIgnored": False, "kpiLabel": spec["kpiLabel"],
        "kpi": spec["kpi"], "kpiCalculation": spec["kpiCalculation"],
        "kpiEvent": {"name": spec["kpiEventName"], "provider": PROVIDER},
    }


# --------------------------------------------------------------------------- #
def main():
    print("Provisioning Meridian business observability (provider=%s, namespace=%s)" % (PROVIDER, NAMESPACE))

    print("- OpenPipeline extraction pipeline")
    pipe_oid = upsert(PIPELINE_SCHEMA, pipeline_value(),
                      lambda v: v.get("customId") == PIPE_CUSTOM_ID)

    print("- Logs routing entry (merge into shared object)")
    routing = list_objects(ROUTING_SCHEMA)
    if not routing:
        sys.exit("FATAL: no %s object found" % ROUTING_SCHEMA)
    robj = routing[0]
    rvalue = robj["value"]
    entries = [e for e in rvalue.get("routingEntries", []) if e.get("description") != PIPE_NAME]
    entries.append(routing_entry(pipe_oid))
    rvalue["routingEntries"] = entries
    status, body = api("PUT", "/objects/" + robj["objectId"], {"value": rvalue})
    if status != 200:
        sys.exit("FATAL: routing PUT failed: %s %s" % (status, body))
    print("  merged routing entry -> %s (%d total)" % (robj["objectId"], len(entries)))

    print("- Business Flows")
    for spec in FLOW_SPECS:
        value = flow_value(spec)
        upsert(FLOW_SCHEMA, value, lambda v, name=value["name"]: v.get("name") == name)

    print("Done.")


if __name__ == "__main__":
    main()

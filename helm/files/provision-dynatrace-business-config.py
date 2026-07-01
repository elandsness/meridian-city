#!/usr/bin/env python3
"""Provision (or deprovision) Meridian City Dynatrace business-observability config.

MULTI-TENANCY: every object this script creates is PER-INSTANCE so that many SEs
can run concurrent Meridian installs against the SAME shared tenant without
colliding. The per-instance hash (DT_INSTANCE_HASH, e.g. "a1b2") is folded into
the bizevent provider, the OpenPipeline customId/displayName, the Business Flow
title prefix, and the routing matcher (which keys on the instance's k8s namespace).

Provision (DT_ACTION=provision, the default) creates idempotently — safe to re-run
on every deploy:
  1. An OpenPipeline custom logs pipeline (customId = meridian-<hash>-business-events)
     that parses the `BusinessEvents` JSON log lines and extracts them as business
     events (`event.provider` = the per-instance provider, e.g. meridian-a1b2.city,
     `event.type` = the business event type) with all correlation fields carried over.
  2. A routing entry that sends THIS instance's `BusinessEvents` logs (matched by
     k8s.namespace.name) into that pipeline — merged into the single shared
     logs-routing object, keyed by this instance's pipeline name so concurrent
     instances each own exactly one entry and never overwrite each other's.
  3. Five Business Flows (one per /analytics business process), titled
     "[Meridian <hash>] ...", wired to the extracted bizevents on one correlation id.

Deprovision (DT_ACTION=delete) removes ONLY this instance's objects — its pipeline,
its routing entry, and its five flows — leaving every other instance's objects (and
the shared routing object itself) intact. Used by the chart's pre-delete hook on
`helm uninstall` / scripts/teardown.sh.

Targets the Dynatrace Settings API via the modern platform endpoint with a
platform token. Matches existing objects by a stable per-instance key so re-runs
update in place rather than duplicating.

Env:
  DT_APPS_URL         e.g. https://<env>.apps.dynatrace.com   (required)
  DT_PLATFORM_TOKEN   dt0s16... with settings:objects:read/write, settings:schemas:read (required)
  DT_EVENT_PROVIDER   per-instance bizevent provider (default: derived from hash)
  DT_LOG_NAMESPACE    k8s namespace the services run in (default: meridian)
  DT_INSTANCE_HASH    short per-instance hash, e.g. "a1b2" (default: "" = legacy single-instance)
  DT_ACTION           provision | delete   (default: provision)
"""
import json
import os
import sys
import urllib.error
import urllib.request
import uuid

APPS = os.environ["DT_APPS_URL"].rstrip("/")
TOKEN = os.environ["DT_PLATFORM_TOKEN"]
NAMESPACE = os.environ.get("DT_LOG_NAMESPACE", "meridian")
HASH = os.environ.get("DT_INSTANCE_HASH", "").strip()
ACTION = os.environ.get("DT_ACTION", "provision").strip().lower()
BASE = APPS + "/platform/classic/environment-api/v2/settings"


def _load_json_env(name):
    """Parse a JSON-object env var; empty/malformed => {} (fall back to defaults)."""
    raw = os.environ.get(name, "").strip()
    if not raw:
        return {}
    try:
        return json.loads(raw)
    except ValueError as e:
        print("WARN: %s is not valid JSON (%s) — ignoring" % (name, e))
        return {}


# Per-industry Dynatrace overrides (empty = City defaults / no naming rules).
SERVICE_NAMES = _load_json_env("DT_SERVICE_NAMES")  # {k8s deployment name: service display name}
FLOW_LABELS = _load_json_env("DT_FLOW_LABELS")      # {flow key: Business Flow display name}
FLOW_KEYS = _load_json_env("DT_FLOWS")              # [flow key, ...] to provision (empty = City default set)

# Per-instance identity. With a hash, every name carries it so concurrent installs
# on the shared tenant stay isolated; without one we keep the legacy single-instance
# names (backwards compatible).
PROVIDER = os.environ.get("DT_EVENT_PROVIDER") or (
    "meridian-%s.city" % HASH if HASH else "meridian.city")
if HASH:
    FLOW_TITLE_PREFIX = "[Meridian %s] " % HASH
    PIPE_CUSTOM_ID = "meridian-%s-business-events" % HASH
    PIPE_NAME = "Meridian City — Business Events (%s)" % HASH
else:
    # Shared-tenant marker even in the legacy case: flow titles are prefixed so
    # Meridian's flows are distinguishable from other teams' on the same tenant.
    FLOW_TITLE_PREFIX = "[Meridian] "
    PIPE_CUSTOM_ID = "meridian-business-events"
    PIPE_NAME = "Meridian City — Business Events"

PIPELINE_SCHEMA = "builtin:openpipeline.logs.pipelines"
ROUTING_SCHEMA = "builtin:openpipeline.logs.routing"
FLOW_SCHEMA = "app:dynatrace.biz.flow:biz-flow-settings"
NAMING_SCHEMA = "builtin:naming.services"

# Stable namespace for deterministic step UUIDs (so re-runs produce identical ids).
# The hash is folded into the seed so two instances' flow objects never share step ids.
_NS = uuid.UUID("a1b2c3d4-e5f6-4000-8000-000000000001")
_SEED_PREFIX = (HASH + "/") if HASH else ""


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


def delete_object(schema, oid):
    status, body = api("DELETE", "/objects/" + oid)
    # 200/204 = deleted; 404 = already gone (idempotent). Anything else is fatal.
    if status not in (200, 204, 404):
        sys.exit("FATAL: delete %s %s failed: %s %s" % (schema.split(":")[-1], oid, status, body))
    print("  deleted: %s -> %s" % (schema.split(":")[-1], oid))


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
    "`flight.id` = bizjson[`flight.id`], `passenger.id` = bizjson[`passenger.id`], "
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
# work_order.id / incident.id / cart.id / order.id / bill.id / flight.id / passenger.id) and
# auto-extracts as a bizevent via the includeAll + isNotNull(meridian.event_type) extraction.
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
    # --- Airport vertical flows (provisioned only when DT_FLOWS selects them) ---
    {"key": "aircraft-turnaround", "name": "Aircraft Turnaround", "correlationID": "flight.id",
     "kpiLabel": "Departures", "kpi": "flight.id", "kpiCalculation": "lastEvent",
     "kpiEventName": "flight.takeoff",
     "steps": [("At gate", "flight.at_gate"), ("Servicing", "flight.servicing"),
               ("Boarding", "flight.boarding"), ("Pushback & taxi", "flight.taxiing"),
               ("Takeoff", "flight.takeoff")]},
    {"key": "passenger-journey", "name": "Passenger Journey", "correlationID": "passenger.id",
     "kpiLabel": "Boarded passengers", "kpi": "passenger.id", "kpiCalculation": "lastEvent",
     "kpiEventName": "passenger.boarded",
     "steps": [("Checked in", "passenger.checked_in"), ("Bag checked", "passenger.bag_checked"),
               ("Security cleared", "passenger.security_cleared"), ("Bag loaded", "passenger.bag_loaded"),
               ("Boarded", "passenger.boarded")]},
]

# City default flow set (used when DT_FLOWS is unset). Industry overlays (e.g. airport)
# pass DT_FLOWS to select a different subset; provision()'s stale-flow cleanup removes any
# of this instance's flows that drop out of the active set on an in-place upgrade.
DEFAULT_FLOW_KEYS = ["service-request", "account-creation", "iot-incident", "purchase", "tax-payment"]
ACTIVE_FLOW_SPECS = [s for s in FLOW_SPECS if s["key"] in (FLOW_KEYS or DEFAULT_FLOW_KEYS)]


def _event(event_type, is_error=False):
    return {"id": "provider:%s-event:%s" % (PROVIDER, event_type), "name": event_type,
            "provider": PROVIDER, "isError": is_error, "isDisabled": False}


def flow_value(spec):
    steps, ids = [], []
    for i, step_spec in enumerate(spec["steps"]):
        name, event_type = step_spec[0], step_spec[1]
        error_types = step_spec[2] if len(step_spec) > 2 else []
        sid = str(uuid.uuid5(_NS, _SEED_PREFIX + spec["key"] + "/" + name))
        ids.append(sid)
        events = [_event(event_type)] + [_event(et, is_error=True) for et in error_types]
        step = {"name": name, "id": sid, "events": events}
        if i == 0:
            step["isRoot"] = True
        steps.append(step)
    connections = [{"id": "%s__%s" % (a, b), "source": a, "target": b}
                   for a, b in zip(ids, ids[1:])]
    return {
        "name": FLOW_TITLE_PREFIX + FLOW_LABELS.get(spec["key"], spec["name"]), "version": 1, "steps": steps, "connections": connections,
        "correlationID": spec["correlationID"], "analysisType": "conversion",
        "analysisCustomLabel": "Conversions", "isSmartscapeTopologyEnabled": False,
        "isDefaultQueryLimitIgnored": False, "kpiLabel": spec["kpiLabel"],
        "kpi": spec["kpi"], "kpiCalculation": spec["kpiCalculation"],
        "kpiEvent": {"name": spec["kpiEventName"], "provider": PROVIDER},
    }


# --------------------------------------------------------------------------- #
# 3. Service naming rules (Path A) — rename the service map per industry, each rule
#    scoped to THIS instance's namespace + deployment so other tenants' services on
#    the shared environment are never affected. Applies to OneAgent-detected services;
#    OTel services are renamed via OTEL_SERVICE_NAME instead. Resilient: any failure
#    warns and continues (the schema payload is tenant-verified at deploy) so it can
#    never abort the pipeline/routing/flows provisioned above.
# --------------------------------------------------------------------------- #
def _naming_rule_value(deployment, display_name):
    return {
        "enabled": True,
        "nameFormat": display_name,
        "rules": [{
            "conditions": [
                {"attribute": "k8s.namespace.name",
                 "comparisonInfo": {"type": "EQUALS", "value": NAMESPACE}},
                {"attribute": "k8s.deployment.name",
                 "comparisonInfo": {"type": "EQUALS", "value": deployment}},
            ],
        }],
    }


def _rule_targets(value, deployment=None):
    """True if the object has a rule scoped to our namespace (and deployment, if given)."""
    for rule in value.get("rules", []):
        conds = rule.get("conditions", [])
        ns_ok = any(c.get("attribute") == "k8s.namespace.name"
                    and c.get("comparisonInfo", {}).get("value") == NAMESPACE for c in conds)
        if not ns_ok:
            continue
        if deployment is None:
            return True
        if any(c.get("attribute") == "k8s.deployment.name"
               and c.get("comparisonInfo", {}).get("value") == deployment for c in conds):
            return True
    return False


def _list_naming():
    status, body = api("GET",
                       "/objects?schemaIds=%s&fields=objectId,value&pageSize=500" % NAMING_SCHEMA)
    if status != 200:
        raise RuntimeError("list %s -> %s %s" % (NAMING_SCHEMA, status, body))
    return body.get("items", [])


def provision_service_names():
    if not SERVICE_NAMES:
        return
    print("- Service naming rules (%d, namespace-scoped)" % len(SERVICE_NAMES))
    try:
        existing = _list_naming()
    except Exception as e:
        print("  WARN: cannot list naming rules (%s) — skipping" % e)
        return
    for deployment, display_name in SERVICE_NAMES.items():
        try:
            match = next((o for o in existing if _rule_targets(o["value"], deployment)), None)
            value = _naming_rule_value(deployment, display_name)
            if match:
                st, bd = api("PUT", "/objects/" + match["objectId"], {"value": value})
                act, oid = "updated", match["objectId"]
            else:
                st, bd = api("POST", "/objects",
                             [{"schemaId": NAMING_SCHEMA, "scope": "environment", "value": value}])
                act = "created"
                oid = bd[0]["objectId"] if isinstance(bd, list) and bd and "objectId" in bd[0] else None
            if st in (200, 201):
                print("  %s: %s -> %r" % (act, deployment, display_name))
            else:
                print("  WARN: naming rule for %s failed: %s %s" % (deployment, st, bd))
        except Exception as e:
            print("  WARN: naming rule for %s errored: %s" % (deployment, e))


def deprovision_service_names():
    print("- Service naming rules (remove this namespace's)")
    try:
        objs = _list_naming()
    except Exception as e:
        print("  WARN: cannot list naming rules (%s) — skipping" % e)
        return
    for o in objs:
        if _rule_targets(o["value"]):
            try:
                api("DELETE", "/objects/" + o["objectId"])
                print("  deleted naming rule -> %s" % o["objectId"])
            except Exception as e:
                print("  WARN: delete naming rule %s failed: %s" % (o["objectId"], e))


# --------------------------------------------------------------------------- #
def provision():
    print("Provisioning Meridian business observability "
          "(instance=%s, provider=%s, namespace=%s)" % (HASH or "(legacy)", PROVIDER, NAMESPACE))

    print("- OpenPipeline extraction pipeline")
    pipe_oid = upsert(PIPELINE_SCHEMA, pipeline_value(),
                      lambda v: v.get("customId") == PIPE_CUSTOM_ID)

    print("- Logs routing entry (merge into shared object)")
    routing = list_objects(ROUTING_SCHEMA)
    if not routing:
        sys.exit("FATAL: no %s object found" % ROUTING_SCHEMA)
    robj = routing[0]
    rvalue = robj["value"]
    # Key this instance's entry by its (per-instance) pipeline name so concurrent
    # instances each own exactly one entry.
    entries = [e for e in rvalue.get("routingEntries", []) if e.get("description") != PIPE_NAME]
    entries.append(routing_entry(pipe_oid))
    rvalue["routingEntries"] = entries
    status, body = api("PUT", "/objects/" + robj["objectId"], {"value": rvalue})
    if status != 200:
        sys.exit("FATAL: routing PUT failed: %s %s" % (status, body))
    print("  merged routing entry -> %s (%d total)" % (robj["objectId"], len(entries)))

    print("- Business Flows")
    wanted_names = set()
    for spec in ACTIVE_FLOW_SPECS:
        value = flow_value(spec)
        wanted_names.add(value["name"])
        upsert(FLOW_SCHEMA, value, lambda v, name=value["name"]: v.get("name") == name)
    # Clean up this instance's stale flows whose label changed (e.g. City -> Airport
    # on an in-place upgrade) so relabeling never leaves duplicates behind.
    for o in list_objects(FLOW_SCHEMA):
        nm = o["value"].get("name", "")
        if nm.startswith(FLOW_TITLE_PREFIX) and nm not in wanted_names:
            delete_object(FLOW_SCHEMA, o["objectId"])

    provision_service_names()

    print("Done.")


def deprovision():
    """Remove ONLY this instance's objects; leave other instances' intact."""
    print("Deprovisioning Meridian business observability "
          "(instance=%s, provider=%s, namespace=%s)" % (HASH or "(legacy)", PROVIDER, NAMESPACE))

    # 1. Drop this instance's routing entry from the shared routing object first
    #    (so it stops referencing the pipeline we are about to delete). Never delete
    #    the shared routing object itself — other instances have entries in it.
    print("- Logs routing entry (remove from shared object)")
    routing = list_objects(ROUTING_SCHEMA)
    if routing:
        robj = routing[0]
        rvalue = robj["value"]
        before = rvalue.get("routingEntries", [])
        entries = [e for e in before if e.get("description") != PIPE_NAME]
        if len(entries) != len(before):
            rvalue["routingEntries"] = entries
            status, body = api("PUT", "/objects/" + robj["objectId"], {"value": rvalue})
            if status != 200:
                sys.exit("FATAL: routing PUT failed: %s %s" % (status, body))
            print("  removed routing entry -> %s (%d remain)" % (robj["objectId"], len(entries)))
        else:
            print("  no routing entry for this instance (already removed)")

    # 2. Delete this instance's OpenPipeline pipeline (matched by per-instance customId).
    print("- OpenPipeline extraction pipeline")
    for o in list_objects(PIPELINE_SCHEMA):
        if o["value"].get("customId") == PIPE_CUSTOM_ID:
            delete_object(PIPELINE_SCHEMA, o["objectId"])

    # 3. Delete this instance's five Business Flows (matched by per-instance title).
    print("- Business Flows")
    # Match any flow carrying this instance's prefix, so all our flows are removed
    # regardless of per-industry label changes across upgrades.
    for o in list_objects(FLOW_SCHEMA):
        if o["value"].get("name", "").startswith(FLOW_TITLE_PREFIX):
            delete_object(FLOW_SCHEMA, o["objectId"])

    deprovision_service_names()

    print("Done.")


def main():
    if ACTION == "delete":
        deprovision()
    elif ACTION == "provision":
        provision()
    else:
        sys.exit("FATAL: unknown DT_ACTION=%r (expected provision|delete)" % ACTION)


if __name__ == "__main__":
    main()

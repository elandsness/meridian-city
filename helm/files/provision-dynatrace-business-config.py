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
  DT_ENTITY_CONFIG    JSON industry.entities block (generic-entity-engine initiative, Stage 5) --
                       the SAME payload entity-engine/movement-service read. Each entity type's
                       own Business Flow spec (steps/correlation/KPI) is DERIVED from its
                       states/transitions rather than hand-maintained here, and its
                       correlation id field (and any ref-field's target type's id) is added to
                       the extraction DQL automatically -- see derive_flow_specs_from_entity_config()
                       and _build_dql_script(). Verified against real Grail data (see
                       docs/regression-baseline-2026-07-23.md-style checks) that Dynatrace's
                       OpenPipeline fieldsAdd is a strict allowlist -- an un-added field is
                       silently dropped, never promoted to a bizevent attribute by
                       fieldExtraction:includeAll on its own -- so this generation step is load-
                       bearing, not cosmetic. Derived specs are UNIONED with the hand-written
                       FLOW_SPECS below (additive) so City/Airport's existing flows keep working
                       until their entity types are actually expressed via DT_ENTITY_CONFIG.
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
# DT_FLOWS can be either:
#   - Array of flow keys (backward compatible): ["service-request", "account-creation"]
#   - Array of full flow definitions: [{key, name, correlationID, kpiLabel, kpi, kpiCalculation, kpiEventName, steps}, ...]
FLOW_KEYS_OR_SPECS = _load_json_env("DT_FLOWS")      # [flow key | flow spec, ...]
ENTITY_CONFIG = _load_json_env("DT_ENTITY_CONFIG")  # {entity type id: {fields,states,transitions,...}}
FLOWS_CONFIG = _load_json_env("DT_FLOWS_CONFIG")      # {flow_id: {entityType, stages}}

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
#: Hand-written correlation keys for flows not yet expressed via DT_ENTITY_CONFIG
#: (City's 5 + Airport's 2 + the generic-services backend's identity/journey ids).
#: Verified against live Grail data (2026-07-24) that OpenPipeline's fieldsAdd is a
#: strict allowlist: a JSON key inside `bizjson["event.type"] that is never named here stays
#: buried in `bizjson["event.type"], which is removed below, so fieldExtraction:includeAll
#: downstream never sees it -- e.g. `citizen.email` and `flight.gate` are present
#: in every raw log line but confirmed ABSENT from the resulting bizevent's fields
#: precisely because nothing here names them.
EXTRA_CORRELATION_KEYS = [k.strip() for k in os.environ.get("DT_EXTRA_CORRELATION_KEYS", "").split(",") if k.strip()]


def _entity_correlation_keys():
    """Every entity type's own fields (id, state, from_state, and all business fields),
    plus any ref-field's target type's <type>.id (so a linked entity's id -- e.g.
    an inspection's linked probe -- is also extractable), derived from DT_ENTITY_CONFIG.
    """
    keys = set()
    for entity_type, definition in ENTITY_CONFIG.items():
        # Core lifecycle fields emitted by EntityEventLogger
        keys.add("%s.id" % entity_type)
        keys.add("%s.state" % entity_type)
        keys.add("%s.from_state" % entity_type)
        
        # Business fields defined in the entity config
        for field_name, field_def in (definition.get("fields") or {}).items():
            keys.add("%s.%s" % (entity_type, field_name))
            # Also extract the ID of the target entity if this is a reference
            if field_def.get("type") == "ref" and field_def.get("entity"):
                keys.add("%s.id" % field_def["entity"])
    return keys


def _build_dql_script():
    keys = sorted(set(EXTRA_CORRELATION_KEYS) | _entity_correlation_keys())
    field_adds = ", ".join("`%s` = bizjson[`%s`]" % (k, k) for k in keys)
    return (
        'parse content, "JSON:bizjson"\n'
        "| fieldsAdd `meridian.event_type` = bizjson[`event.type`]\n"
        "| fieldsAdd %s\n"
        "| fieldsRemove bizjson"
    ) % field_adds


DQL_SCRIPT = _build_dql_script()


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
FLOW_SPECS = []

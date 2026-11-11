#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import yaml from 'js-yaml'
import Ajv2020 from 'ajv/dist/2020.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const schemaPath = join(__dirname, '..', 'docs', 'industry-config.schema.json')
const files = process.argv.slice(2)
if (files.length === 0) { process.exit(2) }
const schema = JSON.parse(readFileSync(schemaPath, 'utf8'))
const ajv = new Ajv2020({ allErrors: true, strict: false })
const validateSchema = ajv.compile(schema)

const YAML_1_1_BOOL_KEY_RE = /(^|[ \t,])(y|Y|yes|Yes|YES|n|N|no|No|NO|on|On|ON|off|Off|OFF)[ \t]*:/g
function checkYamlBooleanKeys(rawText) {
  const errors = []
  const lines = rawText.split('\n')
  lines.forEach((line, i) => {
    YAML_1_1_BOOL_KEY_RE.lastIndex = 0
    let m; while ((m = YAML_1_1_BOOL_KEY_RE.exec(line))) {
      errors.push(`line ${i + 1}: bare key "${m[1]}:" is parsed as a boolean by Helm`);
    }
  })
  return errors
}

function checkEntities(entities) {
  const errors = []
  if (!entities || typeof entities !== 'object') return errors
  const entityIds = new Set(Object.keys(entities).filter((id) => entities[id] !== null))
  for (const [entityId, def] of Object.entries(entities)) {
    if (def === null) continue
    const states = def.states ? Object.keys(def.states) : []
    const stateSet = new Set(states)
    if (def.initial && !stateSet.has(def.initial)) errors.push(`entities.${entityId}.initial "${def.initial}" is not a key in states`)
    if (states.length && !states.some((s) => def.states[s]?.terminal)) errors.push(`entities.${entityId}.states has no terminal:true state`)
    for (const [i, t] of (def.transitions || []).entries()) {
      if (t.from && !stateSet.has(t.from)) errors.push(`entities.${entityId}.transitions[${i}].from "${t.from}" is not a key in states`)
      if (t.to && !stateSet.has(t.to)) errors.push(`entities.${entityId}.transitions[${i}].to "${t.to}" is not a key in states`)
    }
    for (const [fieldId, field] of Object.entries(def.fields || {})) {
      if (field.type === 'ref' && field.entity && !entityIds.has(field.entity)) errors.push(`entities.${entityId}.fields.${fieldId}.entity "${field.entity}" is not a key in entities`)
    }
  }
  return errors
}

function checkIot(iot) {
  const errors = []
  if (!iot || typeof iot !== 'object') return errors
  for (const [i, dt] of (iot.deviceTypes || []).entries()) {
    if (dt.type && dt.metrics) {
      for (const [j, m] of dt.metrics.entries()) {
        if (typeof m.min === 'number' && typeof m.max === 'number' && m.min >= m.max) errors.push(`iot.deviceTypes[${i}].metrics[${j}] min >= max`);
      }
    }
  }
  return errors
}

const VALID_SERVICE_NAME_KEYS = new Set(['customer-entity-service', 'ops-entity-service', 'identity-service', 'journey-service', 'movement-service', 'routing-service', 'workflow-service', 'api-gateway', 'notification-service', 'billing-service'])
// The provisioner's hand-written legacy FLOW_SPECS (service-request,
// account-creation, tax-payment, aircraft-turnaround, passenger-journey, ...)
// were removed entirely (helm/files/provision-dynatrace-business-config.py:
// `FLOW_SPECS = []`, `DEFAULT_FLOW_KEYS = []`). Every flow is now derived
// from an industry.entities type with states/initial -- there is no more
// hardcoded legacy-id allowlist to check against.
const VALID_FLOW_IDS = new Set()

function checkRouting(cfg) {
  const errors = []
  if (cfg.terminology?.routing) errors.push('terminology.routing is not a valid key');
  const categories = cfg.terminology?.requestCategories ?? []
  if (!Array.isArray(categories)) {
    errors.push('terminology.requestCategories must be an array of category-key strings (labels belong in `routing`, keyed by the same category strings)')
    return errors
  }
  if (!cfg.routing) return errors
  const routingKeys = new Set(Object.keys(cfg.routing))
  for (const cat of categories) { if (!routingKeys.has(cat)) errors.push(`missing routing key for ${cat}`) }
  return errors
}

function checkDynatrace(cfg) {
  const errors = []
  const dt = cfg.dynatrace
  if (!dt) return errors
  for (const key of Object.keys(dt.serviceNames ?? {})) { if (!VALID_SERVICE_NAME_KEYS.has(key)) errors.push(`invalid service name ${key}`) }
  const derivableEntityFlowIds = new Set(Object.entries(cfg.entities ?? {}).filter(([, def]) => def?.states && def?.initial).map(([id]) => id))
  for (const [i, flow] of (dt.flows ?? []).entries()) {
    const flowId = typeof flow === 'string' ? flow : flow?.id;
    if (!flowId) { errors.push(`dynatrace.flows[${i}] must have id`); continue; }
    if (typeof flow === 'object' && !flow.correlationID) errors.push(`dynatrace.flows[${i}].id "${flowId}" missing correlationID`);
    if (!VALID_FLOW_IDS.has(flowId) && !derivableEntityFlowIds.has(flowId)) errors.push(`invalid flow id ${flowId}`);
  }
  return errors
}

function checkJourneyService(parsed, cfg, isValuesOverlay) {
  const errors = []
  const journeyDef = cfg.entities?.journey
  const allPlacements = [...(cfg.screens?.public ?? []), ...(cfg.screens?.ops ?? []), ...(cfg.home?.public ?? []), ...(cfg.home?.ops ?? [])]
  const usesJourneyEntityType = allPlacements.some(item => typeof item === 'object' && item?.entityType === 'journey')
  if (!journeyDef && !usesJourneyEntityType) return errors
  for (const stateKey of Object.keys(journeyDef?.states ?? {})) { if (!['initiated', 'in_progress', 'completed'].includes(stateKey)) errors.push(`invalid journey state ${stateKey}`) }
  return errors
}

function checkScreens(cfg) { return []; }
function checkRuntimeOwnership(parsed, cfg) { return []; }

// Confirmed live: a bare {x, "y"} object (no enclosing array) fails Jackson
// deserialization on the backend (`List<Waypoint>` expected) and crashes the
// service on startup. AUTHORING_PROMPT.md's own example used to show this
// wrong shape -- fixed there too, but keep this check so a stale/cached
// prompt copy can't reintroduce it silently.
function checkWaypoints(entities) {
  const errors = []
  for (const [entityId, def] of Object.entries(entities || {})) {
    if (!def) continue
    const waypoints = def.computed?.position?.waypoints
    if (!waypoints || typeof waypoints !== 'object') continue
    for (const [state, val] of Object.entries(waypoints)) {
      if (!Array.isArray(val)) errors.push(`entities.${entityId}.computed.position.waypoints.${state} must be an array of points (e.g. [{x: 1, "y": 2}]), not a bare object -- the backend deserializes this as a List and crashes on startup otherwise`)
    }
  }
  return errors
}

// Fields set by some transition's spawnLinked/set effect don't need a
// generator.fields hint -- collect which (entityType, fieldName) pairs are
// covered that way before flagging "will always be null".
function collectEffectSetFields(entities) {
  const result = {}
  for (const def of Object.values(entities || {})) {
    if (!def) continue
    for (const t of def.transitions || []) {
      for (const eff of t.effects || []) {
        if (eff?.action === 'spawnLinked' && eff.entityType && eff.fields && typeof eff.fields === 'object') {
          result[eff.entityType] = result[eff.entityType] || new Set()
          for (const f of Object.keys(eff.fields)) result[eff.entityType].add(f)
        }
      }
    }
  }
  return result
}

// Confirmed live: entities.permit had a complete `fields:` block (including
// an `enum` field with its own `values:` list) but no `generator.fields` --
// every single generated record, in every business event, carried nothing
// but nulls for all of them. Scoped to `required: true` fields to avoid
// flagging fields intentionally left to be filled in later via the API.
function checkGeneratedFieldCoverage(entities) {
  const errors = []
  if (!entities || typeof entities !== 'object') return errors
  const effectSetFields = collectEffectSetFields(entities)
  for (const [entityId, def] of Object.entries(entities)) {
    if (!def || typeof def !== 'object') continue
    const genFields = def.generator?.fields || {}
    const externallySet = effectSetFields[entityId] || new Set()
    for (const [fieldName, fieldDef] of Object.entries(def.fields || {})) {
      if (!fieldDef?.required) continue
      if (fieldDef.type === 'ref' || fieldDef.type === 'password') continue
      if (fieldDef.default !== undefined) continue
      if (Object.prototype.hasOwnProperty.call(genFields, fieldName)) continue
      if (externallySet.has(fieldName)) continue
      errors.push(`entities.${entityId}.fields.${fieldName} is required but has no default, no generator.fields.${fieldName} hint, and no effect sets it -- it will be null on every generated record`)
    }
  }
  return errors
}

// Confirmed live: `fields: { permit_number: "permit_number" }` on a
// spawnLinked effect wrote the literal string "permit_number" into every
// spawned entity -- a plain string is always a literal value, never a field
// reference (use `{ from: "permit_number" }` to copy). Flagging the specific
// case where the literal string equals its own key: that's never a
// plausible intentional value, only ever a forgotten `{ from: ... }`.
function checkEffectFieldRefs(entities) {
  const errors = []
  for (const [entityId, def] of Object.entries(entities || {})) {
    if (!def) continue
    for (const [ti, t] of (def.transitions || []).entries()) {
      for (const [ei, eff] of (t.effects || []).entries()) {
        if (eff?.action !== 'spawnLinked' || !eff.fields || typeof eff.fields !== 'object') continue
        for (const [key, val] of Object.entries(eff.fields)) {
          if (typeof val === 'string' && val === key) {
            errors.push(`entities.${entityId}.transitions[${ti}].effects[${ei}].fields.${key} is the literal string "${key}" -- if you meant to copy entities.${entityId}'s own "${key}" field, use { from: "${key}" } instead (a plain string is always a literal, never a field reference)`)
          }
        }
      }
    }
  }
  return errors
}

// `service_request` is the one base-chart entity industries are told to
// "redefine" rather than null. Helm deep-merges maps key-by-key, so a
// redefinition does NOT replace the city's own fields/states/generator --
// it silently inherits whatever the overlay doesn't explicitly override.
// Give every entity its own distinct key (and null service_request like the
// other base entities) instead.
function checkBaseEntityRedefinition(cfg) {
  const errors = []
  if (cfg.entities && Object.prototype.hasOwnProperty.call(cfg.entities, 'service_request') && cfg.entities.service_request !== null) {
    errors.push('entities.service_request is redefined (non-null) -- this merges with the base city entity instead of replacing it (Helm deep-merges maps; only `null` deletes a key). Give your entity a new key and set `service_request: null` instead.')
  }
  return errors
}

let failures = 0
for (const path of files) {
  let cfg, parsed, isValuesOverlay = false
  const rawText = readFileSync(path, 'utf8')
  const yamlKeyErrors = checkYamlBooleanKeys(rawText)
  if (yamlKeyErrors.length) { yamlKeyErrors.forEach(err => console.error(`✗ ${path}: ${err}`)); failures++; continue; }
  try {
    parsed = yaml.load(rawText)
    if (parsed && typeof parsed === 'object' && 'industry' in parsed) { cfg = parsed.industry; isValuesOverlay = true; }
    else if (parsed && typeof parsed === 'object' && ('company' in parsed || 'theme' in parsed || 'screens' in parsed)) { cfg = parsed; }
    else { continue; }
  } catch (e) { failures++; continue; }

  const schemaErrors = []
  if (!validateSchema(cfg)) {
    for (const e of validateSchema.errors ?? []) {
      schemaErrors.push(`${e.instancePath || '(root)'} ${e.message}${e.params ? ' ' + JSON.stringify(e.params) : ''}`)
    }
  }

  const semanticErrors = [
    ...schemaErrors,
    ...checkEntities(cfg.entities),
    ...checkIot(cfg.iot),
    ...checkRouting(cfg),
    ...checkDynatrace(cfg),
    ...checkBaseEntityRedefinition(cfg),
    ...checkWaypoints(cfg.entities),
    ...checkGeneratedFieldCoverage(cfg.entities),
    ...checkEffectFieldRefs(cfg.entities),
    ...checkScreens(cfg),
    ...checkJourneyService(parsed, cfg, isValuesOverlay),
    ...checkRuntimeOwnership(parsed, cfg),
  ]
  if (semanticErrors.length) { semanticErrors.forEach(err => console.error(`✗ ${path}: ${err}`)); failures++; } else { console.log(`✓ ${path} valid`); }
}
process.exit(failures ? 1 : 0)
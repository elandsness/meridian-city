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

const YAML_1_1_BOOL_KEY_RE = /[{,}\s*(y|Y|yes|Yes|YES|n|N|no|No|NO|on|On|ON|off|Off|OFF)\s*:/g
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

const VALID_SERVICE_NAME_KEYS = new Set(['citizen-service', 'city-operations', 'service-dispatch', 'api-gateway', 'notification-service', 'billing-service'])
const VALID_FLOW_IDS = new Set(['service-request', 'account-creation', 'tax-payment', 'aircraft-turnaround', 'passenger-journey'])

function checkRouting(cfg) {
  const errors = []
  if (cfg.terminology?.routing) errors.push('terminology.routing is not a valid key');
  if (!cfg.routing) return errors
  const routingKeys = new Set(Object.keys(cfg.routing))
  const categories = cfg.terminology?.requestCategories ?? []
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

let failures = 0
for (const path of files) {
  let cfg, parsed, isValuesOverlay = false
  const rawText = readFileSync(path, 'utf8')
  const yamlKeyErrors = checkYamlBooleanKeys(rawText)
  if (yamlKeyErrors.length) { console.error(`✗ ${path}: ${yamlKeyErrors.length} errors`); failures++; continue; }
  try {
    parsed = yaml.load(rawText)
    if (parsed && typeof parsed === 'object' && 'industry' in parsed) { cfg = parsed.industry; isValuesOverlay = true; }
    else if (parsed && typeof parsed === 'object' && ('company' in parsed || 'theme' in parsed || 'screens' in parsed)) { cfg = parsed; }
    else { continue; }
  } catch (e) { failures++; continue; }

  const semanticErrors = [
    ...checkEntities(cfg.entities),
    ...checkIot(cfg.iot),
    ...checkRouting(cfg),
    ...checkDynatrace(cfg),
    ...checkScreens(cfg),
    ...checkJourneyService(parsed, cfg, isValuesOverlay),
    ...checkRuntimeOwnership(parsed, cfg),
  ]
  if (semanticErrors.length) { console.error(`✗ ${path}: ${semanticErrors.length} errors`); failures++; } else { console.log(`✓ ${path} valid`); }
}
process.exit(failures ? 1 : 0)

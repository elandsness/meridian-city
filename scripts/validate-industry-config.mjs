#!/usr/bin/env node
// Validates a Meridian industry config against docs/industry-config.schema.json
// using ajv, plus a few semantic checks ajv's structural validation can't express
// (cross-references within the same document: state reachability, transition
// endpoints, entity refs). Accepts either a `values-<industry>.yaml` overlay
// (reads its top-level `industry:` key) or an already-rendered config.json —
// YAML is a superset of JSON, so both parse the same way.
//
// Usage: node scripts/validate-industry-config.mjs <file> [<file> ...]
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import yaml from 'js-yaml'
import Ajv2020 from 'ajv/dist/2020.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const schemaPath = join(__dirname, '..', 'docs', 'industry-config.schema.json')

const files = process.argv.slice(2)
if (files.length === 0) {
  console.error('usage: node scripts/validate-industry-config.mjs <file> [<file> ...]')
  process.exit(2)
}

const schema = JSON.parse(readFileSync(schemaPath, 'utf8'))
const ajv = new Ajv2020({ allErrors: true, strict: false })
const validateSchema = ajv.compile(schema)

// --- semantic checks ajv can't express (cross-references within one document) ---
function checkEntities(entities) {
  const errors = []
  if (!entities || typeof entities !== 'object') return errors
  const entityIds = new Set(Object.keys(entities))

  for (const [entityId, def] of Object.entries(entities)) {
    const states = def.states ? Object.keys(def.states) : []
    const stateSet = new Set(states)

    if (def.initial && !stateSet.has(def.initial)) {
      errors.push(`entities.${entityId}.initial "${def.initial}" is not a key in states`)
    }
    if (states.length && !states.some((s) => def.states[s]?.terminal)) {
      errors.push(`entities.${entityId}.states has no terminal:true state`)
    }
    for (const [i, t] of (def.transitions || []).entries()) {
      if (t.from && !stateSet.has(t.from)) {
        errors.push(`entities.${entityId}.transitions[${i}].from "${t.from}" is not a key in states`)
      }
      if (t.to && !stateSet.has(t.to)) {
        errors.push(`entities.${entityId}.transitions[${i}].to "${t.to}" is not a key in states`)
      }
    }
    for (const [fieldId, field] of Object.entries(def.fields || {})) {
      if (field.type === 'ref' && field.entity && !entityIds.has(field.entity)) {
        errors.push(`entities.${entityId}.fields.${fieldId}.entity "${field.entity}" is not a key in entities`)
      }
    }
    if (def.computed?.position?.waypoints) {
      for (const stateKey of Object.keys(def.computed.position.waypoints)) {
        if (!stateSet.has(stateKey)) {
          errors.push(`entities.${entityId}.computed.position.waypoints has key "${stateKey}" which is not a key in states`)
        }
      }
    }

    // Reachability from `initial`, walking declared transitions.
    if (def.initial && stateSet.has(def.initial)) {
      const adjacency = new Map(states.map((s) => [s, []]))
      for (const t of def.transitions || []) {
        if (adjacency.has(t.from) && stateSet.has(t.to)) adjacency.get(t.from).push(t.to)
      }
      const reached = new Set([def.initial])
      const queue = [def.initial]
      while (queue.length) {
        for (const next of adjacency.get(queue.shift()) || []) {
          if (!reached.has(next)) { reached.add(next); queue.push(next) }
        }
      }
      const unreachable = states.filter((s) => !reached.has(s) && !def.states[s]?.externallyTriggered)
      if (unreachable.length) {
        errors.push(`entities.${entityId}.states has state(s) unreachable from "${def.initial}": ${unreachable.join(', ')}`)
      }
    }
  }
  return errors
}

const VALID_SERVICE_NAME_KEYS = new Set([
  'citizen-service', 'city-operations', 'service-dispatch',
  'api-gateway', 'notification-service', 'billing-service',
])

const VALID_FLOW_IDS = new Set([
  'service-request', 'account-creation', 'iot-incident',
  'tax-payment', 'aircraft-turnaround', 'passenger-journey',
])

function checkRouting(cfg) {
  const errors = []

  // Detect routing nested under terminology (a common authoring mistake)
  if (cfg.terminology?.routing) {
    errors.push(
      'terminology.routing is not a valid key — routing must be a TOP-LEVEL key ' +
      '(same level as terminology, entities, data, dynatrace). ' +
      'The nested block is silently ignored; move it to the top level.'
    )
  }

  if (!cfg.routing) return errors

  const routingKeys = new Set(Object.keys(cfg.routing))

  // requestCategories → routing: every category must have a routing key
  const categories = cfg.terminology?.requestCategories ?? []
  for (const cat of categories) {
    if (!routingKeys.has(cat)) {
      errors.push(
        `terminology.requestCategories contains "${cat}" but routing has no matching key. ` +
        `Add: routing.${cat}: "<department name>". ` +
        (cat === 'other' ? '(tip: other: "General Support" is always required)' : '')
      )
    }
  }

  // routing → requestTemplates: every template category must have a routing key
  for (const [i, tmpl] of (cfg.data?.requestTemplates ?? []).entries()) {
    if (tmpl.category && !routingKeys.has(tmpl.category)) {
      errors.push(`data.requestTemplates[${i}].category "${tmpl.category}" has no matching key in routing`)
    }
  }

  // routing → categories: every routing key should appear in requestCategories (dead config if not)
  const catSet = new Set(categories)
  for (const key of routingKeys) {
    if (catSet.size > 0 && !catSet.has(key)) {
      errors.push(
        `routing has key "${key}" but it does not appear in terminology.requestCategories — dead config`
      )
    }
  }

  return errors
}

function checkDynatrace(cfg) {
  const errors = []
  const dt = cfg.dynatrace
  if (!dt) return errors

  // serviceNames: only valid platform keys allowed
  for (const key of Object.keys(dt.serviceNames ?? {})) {
    if (!VALID_SERVICE_NAME_KEYS.has(key)) {
      const suggestion = key === 'grid-operations' ? ' (did you mean city-operations?)'
        : key === 'field-service' || key === 'field-operations' ? ' (did you mean service-dispatch?)'
        : ''
      errors.push(
        `dynatrace.serviceNames has invalid key "${key}"${suggestion}. ` +
        `Valid keys: ${[...VALID_SERVICE_NAME_KEYS].join(', ')}`
      )
    }
  }

  // flows: only valid ids allowed
  for (const [i, flow] of (dt.flows ?? []).entries()) {
    if (!VALID_FLOW_IDS.has(flow)) {
      errors.push(
        `dynatrace.flows[${i}] "${flow}" is not a valid flow id. ` +
        `Valid ids: ${[...VALID_FLOW_IDS].join(', ')}`
      )
    }
  }

  // tax-payment required when billing screen is active
  const publicScreenIds = (cfg.screens?.public ?? []).map((s) =>
    typeof s === 'string' ? s : s?.id
  )
  if (publicScreenIds.includes('billing') && !(dt.flows ?? []).includes('tax-payment')) {
    errors.push(
      'billing is in screens.public but tax-payment is not in dynatrace.flows — ' +
      'add tax-payment to flows and add a flowLabels.tax-payment entry'
    )
  }

  return errors
}

function collectScreenEntityTypes(screens) {
  const types = new Set()
  for (const screen of screens ?? []) {
    if (typeof screen === 'object' && screen?.entityType) types.add(screen.entityType)
    if (typeof screen === 'object' && Array.isArray(screen?.entityTypes)) {
      for (const t of screen.entityTypes) types.add(t)
    }
  }
  return types
}

function collectHomeEntityTypes(home) {
  const types = new Set()
  const allModules = [...(home?.public ?? []), ...(home?.ops ?? [])]
  for (const mod of allModules) {
    if (typeof mod === 'object' && mod?.entityType) types.add(mod.entityType)
    if (typeof mod === 'object' && Array.isArray(mod?.entityTypes)) {
      for (const t of mod.entityTypes) types.add(t)
    }
  }
  return types
}

function checkScreens(cfg) {
  const errors = []
  const warnings = []

  const allScreens = [
    ...(cfg.screens?.public ?? []),
    ...(cfg.screens?.ops ?? []),
  ]

  // entity-journey + ownerField in the public portal
  for (const screen of cfg.screens?.public ?? []) {
    if (typeof screen === 'object' && screen?.template === 'entity-journey' && screen?.ownerField) {
      errors.push(
        `screens.public[id="${screen.id}"]: entity-journey with ownerField is not supported for custom entities. ` +
        `The portal has no mechanism to create custom entity instances on behalf of a logged-in user, ` +
        `so every user sees an empty journey. ` +
        `Replace with template: entity-list (remove ownerField — shows all entities as a live feed).`
      )
    }
  }

  // generator entities must appear in at least one screen or home module.
  // Exception: periodicHistoryBackfill is the billing system's generator — its
  // entities are surfaced through the built-in `billing` screen, not a custom screen.
  const screenTypes = collectScreenEntityTypes(allScreens)
  const homeTypes = collectHomeEntityTypes(cfg.home)
  const surfacedTypes = new Set([...screenTypes, ...homeTypes])

  const publicScreenIds = new Set(
    (cfg.screens?.public ?? []).map((s) => (typeof s === 'string' ? s : s?.id))
  )
  const billingScreenActive = publicScreenIds.has('billing')

  for (const [entityId, def] of Object.entries(cfg.entities ?? {})) {
    if (!def.generator) continue
    if (def.generator.strategy === 'periodicHistoryBackfill' && billingScreenActive) continue
    if (!surfacedTypes.has(entityId)) {
      errors.push(
        `entities.${entityId} has a generator but does not appear in any screen or home module — ` +
        `the engine creates entities that are invisible to users. ` +
        `Add a screen (entity-list, entity-map, entity-journey) or remove the generator.`
      )
    }
  }

  return [...errors, ...warnings]
}

let failures = 0
for (const path of files) {
  let cfg
  try {
    const parsed = yaml.load(readFileSync(path, 'utf8'))
    const isObj = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    if (isObj && 'industry' in parsed) {
      cfg = parsed.industry
    } else if (isObj && ('company' in parsed || 'theme' in parsed || 'screens' in parsed)) {
      cfg = parsed // already a bare rendered config.json, not a values-*.yaml overlay
    } else {
      console.log(`… ${path}: skipped (no industry: block — not an industry-config overlay)`)
      continue
    }
  } catch (e) {
    console.error(`✗ ${path}: not valid YAML/JSON — ${e.message}`)
    failures++
    continue
  }

  // A partial overlay (e.g. values-synthetic-test.yaml) may set only `entities:`
  // and rely on the base values.yaml for company/theme/screens. Detect this by
  // checking for the absence of every top-level required field — skip structural
  // validation but still run semantic entity checks so cross-reference bugs surface.
  const isPartialOverlay = !cfg.version && !cfg.company && !cfg.theme && !cfg.screens
  if (isPartialOverlay) {
    const semanticErrors = checkEntities(cfg.entities)
    if (semanticErrors.length) {
      console.error(`✗ ${path}: ${semanticErrors.length} error(s) (partial overlay):`)
      for (const e of semanticErrors) console.error(`  - ${e}`)
      failures++
    } else {
      console.log(`… ${path}: partial overlay (entities-only) — structural validation skipped`)
    }
    continue
  }

  const structurallyValid = validateSchema(cfg)
  // Always run semantic checks — they produce more actionable messages than raw schema errors
  // and some (like routing-inside-terminology) are the root cause of schema failures.
  const semanticErrors = [
    ...checkEntities(cfg.entities),
    ...checkRouting(cfg),
    ...checkDynatrace(cfg),
    ...checkScreens(cfg),
  ]
  // Only surface raw AJV errors that aren't already explained by a semantic check.
  const semanticPaths = new Set(semanticErrors.map((e) => e.split(':')[0].trim()))
  const ajvErrors = structurallyValid
    ? []
    : (validateSchema.errors ?? [])
        .map((e) => `${e.instancePath || '(root)'} ${e.message}`)
        .filter((msg) => {
          // Suppress the raw AJV error for terminology.routing — our semantic check
          // explains it more clearly.
          if (msg.includes('/terminology/routing')) return false
          return true
        })
  const allErrors = [...ajvErrors, ...semanticErrors]

  if (allErrors.length) {
    console.error(`✗ ${path}: ${allErrors.length} error(s):`)
    for (const e of allErrors) console.error(`  - ${e}`)
    failures++
  } else {
    console.log(`✓ ${path}: valid industry config (${cfg.company?.name ?? '?'})`)
  }
}

process.exit(failures ? 1 : 0)

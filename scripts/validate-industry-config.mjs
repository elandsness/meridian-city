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

function checkRouting(cfg) {
  const errors = []
  if (!cfg.routing || !cfg.data?.requestTemplates) return errors
  const routingKeys = new Set(Object.keys(cfg.routing))
  for (const [i, tmpl] of cfg.data.requestTemplates.entries()) {
    if (tmpl.category && !routingKeys.has(tmpl.category)) {
      errors.push(`data.requestTemplates[${i}].category "${tmpl.category}" has no matching key in routing`)
    }
  }
  return errors
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
  const semanticErrors = structurallyValid ? [...checkEntities(cfg.entities), ...checkRouting(cfg)] : []
  const ajvErrors = structurallyValid ? [] : validateSchema.errors.map((e) => `${e.instancePath || '(root)'} ${e.message}`)
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

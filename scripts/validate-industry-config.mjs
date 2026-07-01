#!/usr/bin/env node
// Lightweight, dependency-free validation of a Meridian industry config (the JSON
// that ends up at /config.json). Mirrors the key constraints in
// docs/industry-config.schema.json so a bad config fails fast before deploy.
// Phase 6 replaces this with full JSON-Schema (ajv) validation wired into CI.
//
// Usage: node scripts/validate-industry-config.mjs <config.json>
import { readFileSync } from 'node:fs'

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/
const ID = /^[a-z][a-z0-9-]*$/
const COLOR_KEYS = ['brand', 'brandDeep', 'brandSoft', 'brandTint', 'accent', 'accentSoft', 'accentInk']
const SCREEN_KEYS = ['public', 'ops', 'disabled']

const path = process.argv[2]
if (!path) {
  console.error('usage: node scripts/validate-industry-config.mjs <config.json>')
  process.exit(2)
}

let cfg
try {
  cfg = JSON.parse(readFileSync(path, 'utf8'))
} catch (e) {
  console.error(`✗ ${path}: not valid JSON — ${e.message}`)
  process.exit(1)
}

const errors = []
const isStr = (v) => typeof v === 'string'
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v)
const check = (cond, msg) => { if (!cond) errors.push(msg) }

check(isObj(cfg), 'root must be an object')
check(cfg.version === 1, 'version must be 1')
if (cfg.id !== undefined) check(isStr(cfg.id) && ID.test(cfg.id), 'id must match ^[a-z][a-z0-9-]*$')

check(isObj(cfg.company), 'company is required (object)')
if (isObj(cfg.company)) {
  check(isStr(cfg.company.name) && cfg.company.name.length > 0, 'company.name is required (non-empty string)')
  if (cfg.company.short !== undefined) check(isStr(cfg.company.short), 'company.short must be a string')
}

check(isObj(cfg.theme) && isObj(cfg.theme.colors), 'theme.colors is required (object)')
if (isObj(cfg.theme) && isObj(cfg.theme.colors)) {
  const colors = cfg.theme.colors
  check(isStr(colors.brand) && HEX.test(colors.brand), 'theme.colors.brand must be a hex color')
  check(isStr(colors.accent) && HEX.test(colors.accent), 'theme.colors.accent must be a hex color')
  for (const [k, v] of Object.entries(colors)) {
    check(COLOR_KEYS.includes(k), `theme.colors has unknown key "${k}"`)
    check(isStr(v) && HEX.test(v), `theme.colors.${k} must be a hex color`)
  }
}

if (cfg.screens !== undefined) {
  check(isObj(cfg.screens), 'screens must be an object')
  for (const key of Object.keys(cfg.screens || {})) {
    check(SCREEN_KEYS.includes(key), `screens has unknown key "${key}"`)
    const list = cfg.screens[key]
    const okItem = (s) =>
      (isStr(s) && ID.test(s)) ||
      (isObj(s) &&
        isStr(s.id) &&
        ID.test(s.id) &&
        (s.label === undefined || isStr(s.label)) &&
        (s.icon === undefined || isStr(s.icon)))
    check(
      Array.isArray(list) && list.every(okItem),
      `screens.${key} items must be a screen id or { id, label?, icon? }`,
    )
  }
}

if (cfg.terminology !== undefined) {
  check(isObj(cfg.terminology), 'terminology must be an object')
  for (const [k, v] of Object.entries(cfg.terminology || {})) {
    check(isStr(v), `terminology.${k} must be a string`)
  }
}

const unique = [...new Set(errors)]
if (unique.length) {
  console.error(`✗ ${path}: ${unique.length} error(s):`)
  for (const e of unique) console.error(`  - ${e}`)
  process.exit(1)
}
console.log(`✓ ${path}: valid industry config (${cfg.company.name})`)

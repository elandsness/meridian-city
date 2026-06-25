'use strict'

/**
 * Journey registry.
 *
 * Each journey has:
 *   name    — identifier used in logs and the /api/v1/scenario endpoint
 *   key     — matches the SCENARIOS config key from config.js
 *   weight  — relative probability (higher = more often)
 *   journey — module with a run() function
 *
 * The weighted pool is a flat array where each entry appears `weight` times,
 * making random selection O(1) without a search loop.
 */

const config = require('../config')

// NOTE: service-request advancement is now driven server-side by citizen-service's
// RequestLifecycleScheduler, so the bot only SUBMITS requests — the old
// handleOpenRequests journey has been retired to avoid double-driving the lifecycle.
const REGISTRY = [
  { name: 'citizenRequest', key: 'citizenRequests', weight: 25, journey: require('./citizenRequest') },
  { name: 'accountCreation', key: 'accountCreation', weight: 20, journey: require('./accountCreation') },
  { name: 'browsing',        key: 'browsing',        weight: 25, journey: require('./browsing') },
  { name: 'storePurchase',   key: 'storePurchase',   weight: 20, journey: require('./storePurchase') },
  { name: 'payTax',          key: 'payTax',          weight: 15, journey: require('./payTax') },
  { name: 'injectAnomaly',   key: 'injectAnomaly',   weight:  8, journey: require('./injectAnomaly') },
  // Lowest weight on purpose: keeps a thin, steady `meridian.chat` baseline (so the
  // llm-latency scenario has a baseline to deviate from) while keeping real LLM cost modest.
  { name: 'chatbot',         key: 'chatbot',         weight:  5, journey: require('./chatbot') },
]

// Runtime enable/disable overrides set via the control API (POST /api/v1/journey).
// Keyed by journey key; when present, takes precedence over the config default so an
// operator can toggle e.g. chat traffic live without a redeploy. In-memory only:
// resets to the config/env defaults on pod restart (same as start/stop and faults).
const _overrides = {}

function isEnabled(entry) {
  return entry.key in _overrides
    ? _overrides[entry.key]
    : Boolean(config.SCENARIOS[entry.key])
}

// Build weighted pool from enabled journeys
function buildPool() {
  return REGISTRY
    .filter(isEnabled)
    .flatMap(e => Array(e.weight).fill({ name: e.name, run: e.journey.run }))
}

let _pool = buildPool()

/**
 * Pick a random journey from the enabled weighted pool.
 * Returns null if all journeys are disabled.
 */
function pickJourney() {
  if (_pool.length === 0) return null
  return _pool[Math.floor(Math.random() * _pool.length)]
}

/**
 * Get a specific journey by name or config key.
 * Used by the /api/v1/scenario endpoint.
 */
function getJourney(nameOrKey) {
  const entry = REGISTRY.find(e => e.name === nameOrKey || e.key === nameOrKey)
  if (!entry) return null
  return { name: entry.name, run: entry.journey.run }
}

/**
 * Enable or disable a journey at runtime and rebuild the weighted pool.
 * Returns the updated { name, key, enabled } entry, or null for an unknown journey.
 */
function setJourneyEnabled(nameOrKey, enabled) {
  const entry = REGISTRY.find(e => e.name === nameOrKey || e.key === nameOrKey)
  if (!entry) return null
  _overrides[entry.key] = Boolean(enabled)
  _pool = buildPool()
  return { name: entry.name, key: entry.key, enabled: _overrides[entry.key] }
}

/**
 * Return summary of all journeys (enabled + disabled) for status reporting.
 * `enabled` reflects the effective state (runtime override if set, else config).
 */
function listJourneys() {
  return REGISTRY.map(e => ({
    name:    e.name,
    weight:  e.weight,
    enabled: isEnabled(e),
  }))
}

module.exports = { pickJourney, getJourney, setJourneyEnabled, listJourneys }

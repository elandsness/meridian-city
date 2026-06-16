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

const REGISTRY = [
  { name: 'citizenRequest', key: 'citizenRequests', weight: 40, journey: require('./citizenRequest') },
  { name: 'accountCreation', key: 'accountCreation', weight: 25, journey: require('./accountCreation') },
  { name: 'browsing',        key: 'browsing',        weight: 30, journey: require('./browsing') },
  { name: 'storePurchase',   key: 'storePurchase',   weight: 15, journey: require('./storePurchase') },
  { name: 'payTax',          key: 'payTax',          weight: 10, journey: require('./payTax') },
  { name: 'chatbot',         key: 'chatbot',         weight:  5, journey: require('./chatbot') },
]

// Build weighted pool from enabled journeys
function buildPool() {
  return REGISTRY
    .filter(e => config.SCENARIOS[e.key])
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
 * Return summary of all journeys (enabled + disabled) for status reporting.
 */
function listJourneys() {
  return REGISTRY.map(e => ({
    name:    e.name,
    weight:  e.weight,
    enabled: Boolean(config.SCENARIOS[e.key]),
  }))
}

module.exports = { pickJourney, getJourney, listJourneys }

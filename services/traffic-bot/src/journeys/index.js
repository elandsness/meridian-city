'use strict'

const config = require('../config')
const { JOURNEY_DEFINITIONS } = require('./journeyDefinitions')
const { runGenericJourney } = require('../genericJourney')

const REGISTRY = Object.entries(JOURNEY_DEFINITIONS).map(([key, def]) => ({
  name: key,
  key: key,
  weight: def.weight,
  run: () => runGenericJourney(def)
}))

const _overrides = {}

function isEnabled(entry) {
  return entry.key in _overrides
    ? _overrides[entry.key]
    : Boolean(config.SCENARIOS[entry.key])
}

function buildPool() {
  return REGISTRY
    .filter(isEnabled)
    .flatMap(e => Array(e.weight).fill({ name: e.name, run: e.run }))
}

let _pool = buildPool()

function pickJourney() {
  if (_pool.length === 0) return null
  return _pool[Math.floor(Math.random() * _pool.length)]
}

function getJourney(nameOrKey) {
  const entry = REGISTRY.find(e => e.name === nameOrKey || e.key === nameOrKey)
  if (!entry) return null
  return { name: entry.name, run: entry.run }
}

function setJourneyEnabled(nameOrKey, enabled) {
  const entry = REGISTRY.find(e => e.name === nameOrKey || e.key === nameOrKey)
  if (!entry) return null
  _overrides[entry.key] = Boolean(enabled)
  _pool = buildPool()
  return { name: entry.name, key: entry.key, enabled: _overrides[entry.key] }
}

function listJourneys() {
  return REGISTRY.map(e => ({
    name:    e.name,
    weight:  e.weight,
    enabled: isEnabled(e),
  }))
}

module.exports = { pickJourney, getJourney, setJourneyEnabled, listJourneys }

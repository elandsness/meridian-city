'use strict'

/**
 * In-memory state tracking for demo-control-api.
 *
 * Tracks:
 *   - Active fault injections for the infra-level scenarios (db-slowdown,
 *     llm-latency, memory-pressure) that each own a plain service-specific
 *     /admin/fault endpoint
 *   - Active scenario (name + start time + auto-reset timer)
 *   - Traffic bot status
 *
 * The business-process exception scenarios (request-failures, flight-cancellations,
 * etc.) are NOT cached here -- they're named fault gates on entity-engine/
 * journey-service, queried live via their GET /api/v1/admin/fault-gates (see
 * routes/commandCenter.js), which is the more honest source of truth than a local
 * mirror. IoT fleet/fault-gate state is likewise queried live via iotOps.js/routes/iot.js.
 */

// ---------------------------------------------------------------------------
// Fault state
// ---------------------------------------------------------------------------

/** @type {Record<string, object>} */
const _faults = {
  'ai-service':           { llm_latency_enabled: false, llm_latency_seconds: 0 },
  'citizen-service':      { db_slowdown_enabled: false, db_slowdown_seconds: 0 },
  'analytics-service':    { memory_pressure_enabled: false },
}

function getFaults () {
  return { ..._faults }
}

function setFault (service, patch) {
  if (_faults[service]) {
    Object.assign(_faults[service], patch)
  }
}

function hasActiveFaults () {
  return Object.values(_faults).some(f =>
    Object.values(f).some(v => v === true || (typeof v === 'number' && v > 0))
  )
}

// ---------------------------------------------------------------------------
// Scenario state
// ---------------------------------------------------------------------------

let _activeScenarioId = null
let _activeScenarioName = null
let _activeScenarioParams = {}
let _scenarioStartedAt = null
/** @type {NodeJS.Timeout | null} */
let _scenarioTimer = null

function getActiveScenario () {
  if (!_activeScenarioId) return null
  return {
    id: _activeScenarioId,
    name: _activeScenarioName,
    params: _activeScenarioParams,
    started_at: _scenarioStartedAt,
  }
}

function setActiveScenario (id, name, autoResetMs, onReset, params = {}) {
  _activeScenarioId = id
  _activeScenarioName = name
  _activeScenarioParams = params || {}
  _scenarioStartedAt = new Date().toISOString()

  if (_scenarioTimer) clearTimeout(_scenarioTimer)
  if (autoResetMs) {
    _scenarioTimer = setTimeout(async () => {
      if (onReset) await onReset().catch(() => {})
      clearActiveScenario()
    }, autoResetMs)
  }
}

function clearActiveScenario () {
  _activeScenarioId = null
  _activeScenarioName = null
  _activeScenarioParams = {}
  _scenarioStartedAt = null
  if (_scenarioTimer) {
    clearTimeout(_scenarioTimer)
    _scenarioTimer = null
  }
}

// ---------------------------------------------------------------------------
// Traffic bot state
// ---------------------------------------------------------------------------

const _traffic = {
  running: false,
  burst_active: false,
  burst_until: null,
}

function getTrafficState () {
  return { ..._traffic }
}

function setTrafficState (patch) {
  Object.assign(_traffic, patch)
}

module.exports = {
  getFaults, setFault, hasActiveFaults,
  getActiveScenario, setActiveScenario, clearActiveScenario,
  getTrafficState, setTrafficState,
}

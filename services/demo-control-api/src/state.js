'use strict'

/**
 * In-memory state tracking for demo-control-api.
 *
 * Tracks:
 *   - Active fault injections per service
 *   - Active scenario (name + start time + auto-reset timer)
 *   - Traffic bot status
 *
 * IoT fleet/fault-gate state is NOT cached here -- the new iot-simulator API
 * (device CRUD + fault gates) is queried live via iotOps.js/routes/iot.js,
 * since device types/counts are entirely config-driven and not a fixed shape
 * worth mirroring locally.
 */

// ---------------------------------------------------------------------------
// Fault state
// ---------------------------------------------------------------------------

/** @type {Record<string, object>} */
const _faults = {
  'ai-service':           { llm_latency_enabled: false, llm_latency_seconds: 0 },
  'citizen-service':      { db_slowdown_enabled: false, db_slowdown_seconds: 0,
                            request_reject_enabled: false, request_reject_rate: 0,
                            account_fail_enabled: false, account_fail_rate: 0 },
  'analytics-service':    { memory_pressure_enabled: false },
  // Business-exception toggles (default off) — see scenarios.js *-failures scenarios.
  'city-operations':      { workorder_escalation_enabled: false, workorder_escalation_rate: 0 },
  'commerce-service':     { checkout_failures_enabled: false, checkout_failures_rate: 0 },
  'billing-service':      { payment_fail_enabled: false, payment_fail_rate: 0 },
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

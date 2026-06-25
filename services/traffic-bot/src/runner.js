'use strict'

/**
 * Traffic runner — manages the journey dispatch loop.
 *
 * Modes:
 *   Normal  — fires journeys at REQUESTS_PER_MINUTE (±20% jitter)
 *   Burst   — 10× normal rate for a configured duration, then reverts
 *
 * The loop is timer-based (setTimeout chain) rather than setInterval so
 * that a slow journey never queues up multiple concurrent executions.
 */

const config   = require('./config')
const journeys = require('./journeys')

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const _state = {
  running:            false,
  burst_active:       false,
  burst_until:        null,
  rpm_normal:         config.REQUESTS_PER_MINUTE,
  rpm_current:        0,
  journeys_completed: 0,
  journeys_failed:    0,
  started_at:         null,
}

/** @type {NodeJS.Timeout | null} */
let _loopTimer  = null
/** @type {NodeJS.Timeout | null} */
let _burstTimer = null

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert RPM to a millisecond interval with ±20% jitter.
 * Minimum 50 ms to avoid spinning too fast in burst mode.
 */
function rpmToMs(rpm) {
  const base   = 60_000 / Math.max(rpm, 1)
  const jitter = base * 0.2 * (Math.random() * 2 - 1)
  return Math.max(50, Math.round(base + jitter))
}

function effectiveRpm() {
  return _state.burst_active
    ? _state.rpm_normal * 10
    : _state.rpm_normal
}

// ---------------------------------------------------------------------------
// Loop
// ---------------------------------------------------------------------------

function _scheduleNext() {
  if (_loopTimer) { clearTimeout(_loopTimer); _loopTimer = null }
  if (!_state.running) return

  _loopTimer = setTimeout(async () => {
    await _runOne()
    _scheduleNext()
  }, rpmToMs(effectiveRpm()))
}

async function _runOne() {
  const journey = journeys.pickJourney()
  if (!journey) return

  try {
    await journey.run()
    _state.journeys_completed++
    console.log(`[runner] ✓ ${journey.name}  completed=${_state.journeys_completed}  failed=${_state.journeys_failed}`)
  } catch (err) {
    _state.journeys_failed++
    console.warn(`[runner] ✗ ${journey.name}: ${err.message}`)
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

function start() {
  if (_state.running) return
  _state.running    = true
  _state.started_at = new Date().toISOString()
  _state.rpm_current = effectiveRpm()
  console.log(`[runner] Starting — ${_state.rpm_normal} RPM, target: ${config.TARGET_URL}`)
  _scheduleNext()
}

function stop() {
  _state.running      = false
  _state.burst_active = false
  _state.burst_until  = null
  _state.rpm_current  = 0
  if (_loopTimer)  { clearTimeout(_loopTimer);  _loopTimer  = null }
  if (_burstTimer) { clearTimeout(_burstTimer); _burstTimer = null }
  console.log('[runner] Stopped')
}

function burst(durationMinutes = 2) {
  const burstRpm = _state.rpm_normal * 10
  _state.burst_active = true
  _state.burst_until  = new Date(Date.now() + durationMinutes * 60_000).toISOString()
  _state.rpm_current  = burstRpm

  // Ensure the loop is running
  if (!_state.running) {
    _state.running    = true
    _state.started_at = new Date().toISOString()
  }

  // Restart loop at burst rate (reschedules the next timer immediately)
  if (_loopTimer) { clearTimeout(_loopTimer); _loopTimer = null }
  _scheduleNext()

  console.log(`[runner] BURST: ${burstRpm} RPM for ${durationMinutes}m (until ${_state.burst_until})`)

  // Schedule end of burst
  if (_burstTimer) clearTimeout(_burstTimer)
  _burstTimer = setTimeout(() => {
    _state.burst_active = false
    _state.burst_until  = null
    _state.rpm_current  = _state.rpm_normal
    _burstTimer = null
    console.log(`[runner] BURST ended — resuming ${_state.rpm_normal} RPM`)
    // The loop naturally continues; next timer will use normal rate
  }, durationMinutes * 60_000)
}

async function runScenario(scenarioName) {
  const journey = journeys.getJourney(scenarioName)
  if (!journey) throw new Error(`Unknown scenario: "${scenarioName}". Valid: citizenRequest, accountCreation, browsing, chatbot`)
  await journey.run()
  return { scenario: scenarioName, completed: true }
}

/**
 * Enable/disable a journey in the running pool (e.g. chat traffic). Affects the
 * normal loop's journey mix immediately; returns the toggled entry or null.
 */
function setJourneyEnabled(nameOrKey, enabled) {
  return journeys.setJourneyEnabled(nameOrKey, enabled)
}

function getStatus() {
  return {
    running:            _state.running,
    burst_active:       _state.burst_active,
    burst_until:        _state.burst_until,
    rpm_normal:         _state.rpm_normal,
    rpm_current:        _state.rpm_current,
    journeys_completed: _state.journeys_completed,
    journeys_failed:    _state.journeys_failed,
    started_at:         _state.started_at,
    target_url:         config.TARGET_URL,
    journeys:           journeys.listJourneys(),
  }
}

module.exports = { start, stop, burst, runScenario, setJourneyEnabled, getStatus }

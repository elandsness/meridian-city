'use strict'

/**
 * Scenario definitions for demo-control-api.
 *
 * Each scenario describes a named demo story that orchestrates one or more fault
 * injections. Scenarios expose:
 *   - `params`: tunable fault knobs the UI renders as sliders and passes back on
 *      start. activate(opts) reads opts[param.name] (falling back to the default).
 *   - `clear`: how the scenario ends — a default mode ('auto' | 'manual') and,
 *      when auto, a default duration in minutes (plus the allowed min/max). The
 *      operator can override both on start via clear_mode / clear_minutes;
 *      activation schedules the auto-reset timer from that choice.
 *
 * Demo scenarios:
 *   db-slowdown      — citizen-service DB latency, tunable (default auto-clear 5m)
 *   llm-latency      — ai-service LLM latency, tunable (default manual)
 *   memory-pressure  — analytics-service leak: tunable cap + ramp (default manual)
 *   cascade-failure  — db-slowdown + llm-latency simultaneously (default manual)
 */

const config = require('./config')
const proxy = require('./proxy')
const state = require('./state')

const CLEAR_MIN = 1
const CLEAR_MAX = 30

/** @type {Record<string, ScenarioDef>} */
const SCENARIOS = {
  'db-slowdown': {
    name: 'Database Slowdown',
    description: 'Injects DB query latency into citizen-service, so submit-request PurePaths show a clear slow span.',
    clear: { mode: 'auto', minutes: 5, min: CLEAR_MIN, max: CLEAR_MAX },
    params: [
      { name: 'seconds', label: 'DB latency', min: 1, max: 10, step: 1, default: 2, unit: 's' },
    ],
    async activate (opts = {}) {
      const seconds = Number(opts.seconds) > 0 ? Number(opts.seconds) : 2
      const r = await proxy.post(`${config.CITIZEN_SERVICE_URL}/admin/fault`, {
        db_slowdown_enabled: true, db_slowdown_seconds: seconds,
      })
      state.setFault('citizen-service', { db_slowdown_enabled: true, db_slowdown_seconds: seconds })
      return r
    },
    async reset () {
      const r = await proxy.post(`${config.CITIZEN_SERVICE_URL}/admin/fault`, {
        db_slowdown_enabled: false, db_slowdown_seconds: 0,
      })
      state.setFault('citizen-service', { db_slowdown_enabled: false, db_slowdown_seconds: 0 })
      return r
    },
  },

  'llm-latency': {
    name: 'LLM Latency Spike',
    description: 'Injects latency before every ai-service LLM call, visible as long meridian.chat spans in AI observability. Needs chat traffic (enable the Chat-traffic toggle, or chat in the portal).',
    clear: { mode: 'manual', minutes: 5, min: CLEAR_MIN, max: CLEAR_MAX },
    params: [
      { name: 'seconds', label: 'LLM latency', min: 1, max: 30, step: 1, default: 10, unit: 's' },
    ],
    async activate (opts = {}) {
      const seconds = Number(opts.seconds) > 0 ? Number(opts.seconds) : 10
      const r = await proxy.post(`${config.AI_SERVICE_URL}/admin/fault`, {
        llm_latency_enabled: true, llm_latency_seconds: seconds,
      })
      state.setFault('ai-service', { llm_latency_enabled: true, llm_latency_seconds: seconds })
      return r
    },
    async reset () {
      const r = await proxy.post(`${config.AI_SERVICE_URL}/admin/fault`, {
        llm_latency_enabled: false, llm_latency_seconds: 0,
      })
      state.setFault('ai-service', { llm_latency_enabled: false, llm_latency_seconds: 0 })
      return r
    },
  },

  'memory-pressure': {
    name: 'Memory Pressure',
    description: 'Leaks analytics-service heap up to a cap over a ramp time. With the cap above the 512 MiB container limit it overshoots and triggers an OOMKill partway up the ramp; below the limit it plateaus (stress without a kill).',
    clear: { mode: 'manual', minutes: 5, min: CLEAR_MIN, max: CLEAR_MAX },
    params: [
      { name: 'cap_mb', label: 'Cap', min: 128, max: 1024, step: 64, default: 512, unit: 'MB' },
      { name: 'ramp_minutes', label: 'Ramp time', min: 1, max: 15, step: 1, default: 3, unit: ' min' },
    ],
    async activate (opts = {}) {
      const cap = Number(opts.cap_mb) > 0 ? Number(opts.cap_mb) : 512
      const rampMin = Number(opts.ramp_minutes) > 0 ? Number(opts.ramp_minutes) : 3
      const r = await proxy.post(`${config.ANALYTICS_SERVICE_URL}/admin/fault`, {
        memory_pressure_enabled: true,
        memory_pressure_cap_mb: cap,
        memory_pressure_ramp_seconds: Math.round(rampMin * 60),
      })
      state.setFault('analytics-service', { memory_pressure_enabled: true })
      return r
    },
    async reset () {
      const r = await proxy.post(`${config.ANALYTICS_SERVICE_URL}/admin/fault`, {
        memory_pressure_enabled: false,
      })
      state.setFault('analytics-service', { memory_pressure_enabled: false })
      return r
    },
  },

  'cascade-failure': {
    name: 'Cascade Failure',
    description: 'Triggers Database Slowdown + LLM Latency Spike simultaneously for a multi-signal incident.',
    clear: { mode: 'manual', minutes: 5, min: CLEAR_MIN, max: CLEAR_MAX },
    params: [],
    async activate (opts = {}) {
      await SCENARIOS['db-slowdown'].activate(opts)
      await SCENARIOS['llm-latency'].activate(opts)
      return { ok: true, data: { message: 'cascade-failure activated' } }
    },
    async reset () {
      await SCENARIOS['db-slowdown'].reset()
      await SCENARIOS['llm-latency'].reset()
      return { ok: true, data: { message: 'cascade-failure reset' } }
    },
  },
}

/**
 * Return metadata for all scenarios (no activate/reset functions).
 */
function listScenarios () {
  return Object.entries(SCENARIOS).map(([id, s]) => ({
    id,
    name: s.name,
    description: s.description,
    clear: s.clear,
    params: s.params ?? [],
  }))
}

/**
 * Activate a scenario by ID, register it as active, and schedule auto-reset
 * based on the chosen clear mode/duration.
 * @param {string} id
 * @param {object} [opts] fault param overrides (e.g. seconds, cap_mb,
 *   ramp_minutes) plus clear_mode ('auto'|'manual') and clear_minutes; the clear
 *   fields fall back to the scenario's defaults when absent.
 * @returns {{ ok: boolean, scenario?: object, error?: string }}
 */
async function activateScenario (id, opts = {}) {
  const scenario = SCENARIOS[id]
  if (!scenario) return { ok: false, error: `Unknown scenario '${id}'` }

  const result = await scenario.activate(opts)

  const clearDefault = scenario.clear || { mode: 'manual', minutes: 5 }
  const mode = (opts.clear_mode === 'auto' || opts.clear_mode === 'manual')
    ? opts.clear_mode
    : clearDefault.mode
  const minutes = Number(opts.clear_minutes) > 0 ? Number(opts.clear_minutes) : clearDefault.minutes
  const autoResetMs = mode === 'auto' ? minutes * 60 * 1000 : null

  state.setActiveScenario(id, scenario.name, autoResetMs, () => scenario.reset(), {
    ...opts, clear_mode: mode, clear_minutes: minutes,
  })

  return {
    ok: result.ok !== false,
    scenario: {
      id,
      name: scenario.name,
      clear: { mode, minutes },
      params: opts,
      started_at: state.getActiveScenario()?.started_at,
    },
  }
}

/**
 * Reset a specific scenario by ID.
 */
async function resetScenario (id) {
  const scenario = SCENARIOS[id]
  if (!scenario) return { ok: false, error: `Unknown scenario '${id}'` }
  return scenario.reset()
}

/**
 * Reset all known scenarios + any services not covered by a named scenario,
 * then clear the active scenario state.
 */
async function resetAll () {
  const scenarioResets = Object.entries(SCENARIOS).map(([id, s]) =>
    s.reset().then(r => ({ id, ...r })).catch(e => ({ id, ok: false, error: e.message }))
  )

  const results = await Promise.all(scenarioResets)

  state.clearActiveScenario()

  // Zero out all local fault state
  for (const key of Object.keys(state.getFaults())) {
    const currentFault = state.getFaults()[key]
    state.setFault(key, Object.fromEntries(
      Object.keys(currentFault).map(k => [k, typeof currentFault[k] === 'number' ? 0 : false])
    ))
  }

  return results
}

module.exports = { SCENARIOS, listScenarios, activateScenario, resetScenario, resetAll }

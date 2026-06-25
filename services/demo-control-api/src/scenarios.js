'use strict'

/**
 * Scenario definitions for demo-control-api.
 *
 * Each scenario describes a named demo story that orchestrates one or more
 * fault injections and/or IoT anomalies. Scenarios can auto-reset after a
 * configured duration.
 *
 * Demo scenarios (from the project plan):
 *   db-slowdown      — citizen-service DB latency, tunable (auto-reset 5 min)
 *   llm-latency      — ai-service LLM latency, tunable (manual reset)
 *   memory-pressure  — analytics-service growing leak, tunable cap (manual reset)
 *   cascade-failure  — db-slowdown + llm-latency simultaneously (manual reset)
 */

const config = require('./config')
const proxy = require('./proxy')
const state = require('./state')

/**
 * Each scenario may declare `params`: tunable knobs the UI renders as sliders and
 * passes back on start. activate(opts) reads opts[param.name] (falling back to the
 * param default), so a scenario works with or without a body.
 * @type {Record<string, ScenarioDef>}
 */
const SCENARIOS = {
  'db-slowdown': {
    name: 'Database Slowdown',
    description: 'Injects DB query latency into citizen-service, so submit-request PurePaths show a clear slow span. Auto-resets after 5 minutes.',
    duration_seconds: 300,
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
    description: 'Injects latency before every ai-service LLM call, visible as long meridian.chat spans in AI observability. Needs chat traffic (enable the Chat-traffic toggle, or chat in the portal). Manual reset required.',
    duration_seconds: null,
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
    description: 'Grows analytics-service heap ~32 MB every 20s (a rising leak curve) up to a configurable cap. With the cap above the 512 MiB container limit it overshoots and triggers an OOMKill. Manual reset required.',
    duration_seconds: null,
    params: [
      { name: 'cap_mb', label: 'Memory cap', min: 128, max: 1024, step: 64, default: 512, unit: 'MB' },
    ],
    async activate (opts = {}) {
      const cap = Number(opts.cap_mb) > 0 ? Number(opts.cap_mb) : 512
      const r = await proxy.post(`${config.ANALYTICS_SERVICE_URL}/admin/fault`, {
        memory_pressure_enabled: true, memory_pressure_cap_mb: cap,
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
    description: 'Triggers Database Slowdown + LLM Latency Spike simultaneously for a multi-signal incident. Manual reset required.',
    duration_seconds: null,
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
    duration_seconds: s.duration_seconds,
    params: s.params ?? [],
  }))
}

/**
 * Activate a scenario by ID, register it as active, and schedule auto-reset.
 * @param {string} id
 * @param {object} [opts] tunable param overrides (e.g. { seconds }, { cap_mb })
 * @returns {{ ok: boolean, scenario?: object, error?: string }}
 */
async function activateScenario (id, opts = {}) {
  const scenario = SCENARIOS[id]
  if (!scenario) return { ok: false, error: `Unknown scenario '${id}'` }

  const result = await scenario.activate(opts)

  const autoResetMs = scenario.duration_seconds ? scenario.duration_seconds * 1000 : null
  state.setActiveScenario(id, scenario.name, autoResetMs, () => scenario.reset(), opts)

  return {
    ok: result.ok !== false,
    scenario: {
      id,
      name: scenario.name,
      duration_seconds: scenario.duration_seconds,
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

'use strict'

/**
 * Scenario definitions for demo-control-api.
 *
 * Each scenario describes a named demo story that orchestrates one or more
 * fault injections and/or IoT anomalies. Scenarios can auto-reset after a
 * configured duration.
 *
 * Demo scenarios (from the project plan):
 *   db-slowdown      — citizen-service DB 2s latency (auto-reset 5 min)
 *   llm-latency      — ai-service LLM 10s latency (manual reset)
 *   kafka-lag        — telemetry-processor Kafka pause (manual reset)
 *   memory-pressure  — analytics-service memory pressure (manual reset)
 *   cascade-failure  — db-slowdown + kafka-lag simultaneously (manual reset)
 */

const config = require('./config')
const proxy = require('./proxy')
const state = require('./state')

/** @type {Record<string, ScenarioDef>} */
const SCENARIOS = {
  'db-slowdown': {
    name: 'Database Slowdown',
    description: 'Injects 2-second DB query latency into citizen-service. Auto-resets after 5 minutes.',
    duration_seconds: 300,
    async activate () {
      const r = await proxy.post(`${config.CITIZEN_SERVICE_URL}/admin/fault`, {
        db_slowdown_enabled: true, db_slowdown_seconds: 2,
      })
      state.setFault('citizen-service', { db_slowdown_enabled: true, db_slowdown_seconds: 2 })
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
    description: 'Injects 10-second latency before every ai-service LLM call. Manual reset required.',
    duration_seconds: null,
    async activate () {
      const r = await proxy.post(`${config.AI_SERVICE_URL}/admin/fault`, {
        llm_latency_enabled: true, llm_latency_seconds: 10,
      })
      state.setFault('ai-service', { llm_latency_enabled: true, llm_latency_seconds: 10 })
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

  'kafka-lag': {
    name: 'Kafka Consumer Lag',
    description: 'Pauses the telemetry-processor Kafka consumer, causing IoT telemetry to back up. Manual reset required.',
    duration_seconds: null,
    async activate () {
      const r = await proxy.post(`${config.TELEMETRY_PROCESSOR_URL}/admin/fault`, {
        kafka_pause_enabled: true,
      })
      state.setFault('telemetry-processor', { kafka_pause_enabled: true })
      return r
    },
    async reset () {
      const r = await proxy.post(`${config.TELEMETRY_PROCESSOR_URL}/admin/fault`, {
        kafka_pause_enabled: false,
      })
      state.setFault('telemetry-processor', { kafka_pause_enabled: false })
      return r
    },
  },

  'memory-pressure': {
    name: 'Memory Pressure',
    description: 'Allocates large buffers in analytics-service to simulate a memory leak. Manual reset required.',
    duration_seconds: null,
    async activate () {
      const r = await proxy.post(`${config.ANALYTICS_SERVICE_URL}/admin/fault`, {
        memory_pressure_enabled: true,
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
    description: 'Triggers db-slowdown + kafka-lag simultaneously. Manual reset required.',
    duration_seconds: null,
    async activate () {
      await SCENARIOS['db-slowdown'].activate()
      await SCENARIOS['kafka-lag'].activate()
      return { ok: true, data: { message: 'cascade-failure activated' } }
    },
    async reset () {
      await SCENARIOS['db-slowdown'].reset()
      await SCENARIOS['kafka-lag'].reset()
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
  }))
}

/**
 * Activate a scenario by ID, register it as active, and schedule auto-reset.
 * @param {string} id
 * @returns {{ ok: boolean, scenario?: object, error?: string }}
 */
async function activateScenario (id) {
  const scenario = SCENARIOS[id]
  if (!scenario) return { ok: false, error: `Unknown scenario '${id}'` }

  const result = await scenario.activate()

  const autoResetMs = scenario.duration_seconds ? scenario.duration_seconds * 1000 : null
  state.setActiveScenario(id, scenario.name, autoResetMs, () => scenario.reset())

  return {
    ok: result.ok !== false,
    scenario: {
      id,
      name: scenario.name,
      duration_seconds: scenario.duration_seconds,
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

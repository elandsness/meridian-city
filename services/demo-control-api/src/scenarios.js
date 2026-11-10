"use strict"

const fs = require('fs')
const config = require('./config')
const proxy = require('./proxy')
const state = require('./state')

// Load Industry Config for Dynamic Scenarios
let industryConfig = {}
const configPath = process.env.INDUSTRY_CONFIG_PATH
if (configPath && fs.existsSync(configPath)) {
  try {
    industryConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'))
  } catch (e) {
    console.error(`Failed to parse industry config at ${configPath}: ${e.message}`)
  }
}

const CLEAR_MIN = 1
const CLEAR_MAX = 30

const pctToFrac = (v, def) => (Number(v) > 0 ? Number(v) : def) / 100
const RATE_PARAM = { name: 'rate', label: 'Failure rate', min: 5, max: 100, step: 5, default: 30, unit: '%' }

/**
 * The SCENARIOS object is now built dynamically.
 * It contains core platform faults and industry-specific business faults.
 */
const SCENARIOS = {
  'db-slowdown': {
    name: 'Database Slowdown',
    description: 'Injects DB query latency into the identity service, visible as slow spans.',
    clear: { mode: 'auto', minutes: 5, min: CLEAR_MIN, max: CLEAR_MAX },
    params: [{ name: 'seconds', label: 'DB latency', min: 1, max: 10, step: 1, default: 2, unit: 's' }],
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
    description: 'Injects latency before every AI service LLM call.',
    clear: { mode: 'manual', minutes: 5, min: CLEAR_MIN, max: CLEAR_MAX },
    params: [{ name: 'seconds', label: 'LLM latency', min: 1, max: 30, step: 1, default: 10, unit: 's' }],
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
    description: 'Leaks analytics-service heap up to a cap over a ramp time.',
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
    description: 'Triggers Database Slowdown + LLM Latency Spike simultaneously.',
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

// Dynamically inject Business Process Faults from Industry Config
if (industryConfig.businessFaults && Array.isArray(industryConfig.businessFaults)) {
  industryConfig.businessFaults.forEach((f, index) => {
    const id = `biz-fault-${index}`
    SCENARIOS[id] = {
      name: f.label || 'Business Process Failure',
      description: f.description || 'Injects a business-process failure into the flow.',
      clear: { mode: 'manual', minutes: 10, min: CLEAR_MIN, max: CLEAR_MAX },
      params: [RATE_PARAM],
      async activate (opts = {}) {
        const rate = pctToFrac(opts.rate, 30)
        return proxy.post(`${f.targetServiceUrl}/api/v1/admin/fault-gates/${f.faultGateName}`, {
          enabled: true, rate,
        })
      },
      async reset () {
        return proxy.post(`${f.targetServiceUrl}/api/v1/admin/fault-gates/${f.faultGateName}`, {
          enabled: false, rate: 0,
        })
      },
    }
  })
}

// The umbrella scenario for all business exceptions
SCENARIOS['business-exceptions'] = {
  name: 'Business Failures',
  description: 'Inject business-process failures across every active business flow defined in the industry config.',
  clear: { mode: 'manual', minutes: 10, min: CLEAR_MIN, max: CLEAR_MAX },
  params: [RATE_PARAM],
  async activate (opts = {}) {
    const businessFaultKeys = Object.keys(SCENARIOS).filter(k => k.startsWith('biz-fault-'))
    const activations = businessFaultKeys.map(k => SCENARIOS[k].activate(opts))
    await Promise.all(activations)
    return { ok: true, data: { message: 'business-exceptions activated' } }
  },
  async reset () {
    const businessFaultKeys = Object.keys(SCENARIOS).filter(k => k.startsWith('biz-fault-'))
    const resets = businessFaultKeys.map(k => SCENARIOS[k].reset())
    await Promise.all(resets)
    return { ok: true, data: { message: 'business-exceptions reset' } }
  },
}

const HIDDEN_SCENARIOS = new Set([
  ...Object.keys(SCENARIOS).filter(k => k.startsWith('biz-fault-'))
])

function listScenarios () {
  return Object.entries(SCENARIOS)
    .filter(([id]) => !HIDDEN_SCENARIOS.has(id))
    .map(([id, s]) => ({
      id,
      name: s.name,
      description: s.description,
      clear: s.clear,
      params: s.params ?? [],
    }))
}

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

async function resetScenario (id) {
  const scenario = SCENARIOS[id]
  if (!scenario) return { ok: false, error: `Unknown scenario '${id}'` }
  return scenario.reset()
}

async function resetAll () {
  const scenarioResets = Object.entries(SCENARIOS).map(([id, s]) =>
    s.reset().then(r => ({ id, ...r })).catch(e => ({ id, ok: false, error: e.message }))
  )

  const results = await Promise.all(scenarioResets)

  state.clearActiveScenario()

  for (const key of Object.keys(state.getFaults())) {
    const currentFault = state.getFaults()[key]
    state.setFault(key, Object.keys(currentFault).map(k => [k, typeof currentFault[k] === 'number' ? 0 : false]))
  }

  return results
}

module.exports = { SCENARIOS, listScenarios, activateScenario, resetScenario, resetAll }

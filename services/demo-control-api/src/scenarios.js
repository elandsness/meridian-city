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

// Named faultGate -> its own declared default rate, but ONLY for gates that
// guard a transition into an isError:true state. A `faultGate` can equally
// name the HAPPY-path branch of a split (e.g. values-nhvr.yaml's
// `intercept-cleared` @0.85 alongside `intercept-defect` @0.15, so an SE can
// dial the whole split) -- "Business Failures" must never touch those, or it
// silently suppresses the success rate, and since the admin API has no
// unconfigure/delete, resetting afterwards would pin it at a permanent 0%
// instead of restoring its real baseline.
function buildFailureGateDefaults (entities) {
  const defaults = {}
  for (const def of Object.values(entities || {})) {
    if (!def) continue
    const states = def.states || {}
    for (const t of def.transitions || []) {
      const gateName = t.when?.faultGate
      if (!gateName) continue
      if (states[t.to]?.isError) defaults[gateName] = Number(t.when.probability) || 0
    }
  }
  return defaults
}
const FAILURE_GATE_DEFAULTS = buildFailureGateDefaults(industryConfig.entities)
if (Object.keys(FAILURE_GATE_DEFAULTS).length === 0) {
  console.warn('[scenarios] No failure-path faultGates found in industry config -- "Business Failures" will sweep every discovered gate (including any happy-path ones) until this is populated.')
}

const FAULT_GATE_SERVICES = [
  { name: 'customer-entity-service', url: () => config.CUSTOMER_ENTITY_SERVICE_URL },
  { name: 'ops-entity-service', url: () => config.OPS_ENTITY_SERVICE_URL },
  { name: 'journey-service', url: () => config.JOURNEY_SERVICE_URL },
]

/** Live gate names per service, filtered to known failure gates -- unless
 * none are known at all, in which case every discovered gate is swept
 * (preserves the old, cruder behavior rather than silently doing nothing). */
async function discoverFailureGates () {
  const haveDefaults = Object.keys(FAILURE_GATE_DEFAULTS).length > 0
  const found = []
  for (const s of FAULT_GATE_SERVICES) {
    const res = await proxy.get(`${s.url()}/api/v1/admin/fault-gates`)
    if (!res.ok || !res.data) continue
    for (const gateName of Object.keys(res.data)) {
      if (haveDefaults && !(gateName in FAILURE_GATE_DEFAULTS)) continue
      found.push({ url: s.url(), gateName, defaultRate: FAILURE_GATE_DEFAULTS[gateName] ?? 0 })
    }
  }
  return found
}

/**
 * The SCENARIOS object is now built dynamically.
 * It contains core platform faults and industry-specific business faults.
 */
const SCENARIOS = {
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
}

// Dynamically inject Business Process Faults from Industry Config

// The umbrella scenario for all business exceptions
SCENARIOS['business-exceptions'] = {
  name: 'Business Failures',
  description: 'Inject business-process failures across every active business flow defined in the industry config.',
  clear: { mode: 'manual', minutes: 10, min: CLEAR_MIN, max: CLEAR_MAX },
  params: [RATE_PARAM],
  async activate (opts = {}) {
    const rate = pctToFrac(opts.rate, 30)
    const gates = await discoverFailureGates()
    await Promise.all(gates.map(g => proxy.post(`${g.url}/api/v1/admin/fault-gates/${g.gateName}`, {
      enabled: true, rate,
    })))
    return { ok: true, data: { message: 'business-exceptions activated', gates: gates.map(g => g.gateName) } }
  },
  async reset () {
    // Restore each gate's own declared default rather than force-disabling it --
    // there's no unconfigure/delete on the admin API, so {enabled:false, rate:0}
    // would permanently zero out a gate whose authored baseline is a positive
    // "fires out of the box" rate (see FaultGateRegistry.java's javadoc).
    const gates = await discoverFailureGates()
    await Promise.all(gates.map(g => proxy.post(`${g.url}/api/v1/admin/fault-gates/${g.gateName}`, {
      enabled: g.defaultRate > 0, rate: g.defaultRate,
    })))
    return { ok: true, data: { message: 'business-exceptions reset', gates: gates.map(g => g.gateName) } }
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
  if (!result || result.ok === false) {
    return { ok: false, error: result?.error || 'Failed to activate scenario' }
  }

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
    ok: true,
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
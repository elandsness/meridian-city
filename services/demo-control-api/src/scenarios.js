1|"use strict"
2|
3|const fs = require('fs')
4|const config = require('./config')
5|const proxy = require('./proxy')
6|const state = require('./state')
7|
8|// Load Industry Config for Dynamic Scenarios
9|let industryConfig = {}
10|const configPath = process.env.INDUSTRY_CONFIG_PATH
11|if (configPath && fs.existsSync(configPath)) {
12|  try {
13|    industryConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'))
14|  } catch (e) {
15|    console.error(`Failed to parse industry config at ${configPath}: ${e.message}`)
16|  }
17|}
18|
19|const CLEAR_MIN = 1
20|const CLEAR_MAX = 30
21|
22|const pctToFrac = (v, def) => (Number(v) > 0 ? Number(v) : def) / 100
23|const RATE_PARAM = { name: 'rate', label: 'Failure rate', min: 5, max: 100, step: 5, default: 30, unit: '%' }
24|
25|/**
26| * The SCENARIOS object is now built dynamically.
27| * It contains core platform faults and industry-specific business faults.
28| */
29|const SCENARIOS = {
30|  'llm-latency': {
31|    name: 'LLM Latency Spike',
32|    description: 'Injects latency before every AI service LLM call.',
33|    clear: { mode: 'manual', minutes: 5, min: CLEAR_MIN, max: CLEAR_MAX },
34|    params: [{ name: 'seconds', label: 'LLM latency', min: 1, max: 30, step: 1, default: 10, unit: 's' }],
35|    async activate (opts = {}) {
36|      const seconds = Number(opts.seconds) > 0 ? Number(opts.seconds) : 10
37|      const r = await proxy.post(`${config.AI_SERVICE_URL}/admin/fault`, {
38|        llm_latency_enabled: true, llm_latency_seconds: seconds,
39|      })
40|      state.setFault('ai-service', { llm_latency_enabled: true, llm_latency_seconds: seconds })
41|      return r
42|    },
43|    async reset () {
44|      const r = await proxy.post(`${config.AI_SERVICE_URL}/admin/fault`, {
45|        llm_latency_enabled: false, llm_latency_seconds: 0,
46|      })
47|      state.setFault('ai-service', { llm_latency_enabled: false, llm_latency_seconds: 0 })
48|      return r
49|    },
50|  },
51|  'memory-pressure': {
52|    name: 'Memory Pressure',
53|    description: 'Leaks analytics-service heap up to a cap over a ramp time.',
54|    clear: { mode: 'manual', minutes: 5, min: CLEAR_MIN, max: CLEAR_MAX },
55|    params: [
56|      { name: 'cap_mb', label: 'Cap', min: 128, max: 1024, step: 64, default: 512, unit: 'MB' },
57|      { name: 'ramp_minutes', label: 'Ramp time', min: 1, max: 15, step: 1, default: 3, unit: ' min' },
58|    ],
59|    async activate (opts = {}) {
60|      const cap = Number(opts.cap_mb) > 0 ? Number(opts.cap_mb) : 512
61|      const rampMin = Number(opts.ramp_minutes) > 0 ? Number(opts.ramp_minutes) : 3
62|      const r = await proxy.post(`${config.ANALYTICS_SERVICE_URL}/admin/fault`, {
63|        memory_pressure_enabled: true,
64|        memory_pressure_cap_mb: cap,
65|        memory_pressure_ramp_seconds: Math.round(rampMin * 60),
66|      })
67|      state.setFault('analytics-service', { memory_pressure_enabled: true })
68|      return r
69|    },
70|    async reset () {
71|      const r = await proxy.post(`${config.ANALYTICS_SERVICE_URL}/admin/fault`, {
72|        memory_pressure_enabled: false,
73|      })
74|      state.setFault('analytics-service', { memory_pressure_enabled: false })
75|      return r
76|    },
77|  },
78|}
79|
80|// Dynamically inject Business Process Faults from Industry Config

// The umbrella scenario for all business exceptions
SCENARIOS['business-exceptions'] = {
  name: 'Business Failures',
  description: 'Inject business-process failures across every active business flow defined in the industry config.',
  clear: { mode: 'manual', minutes: 10, min: CLEAR_MIN, max: CLEAR_MAX },
  params: [RATE_PARAM],
  async activate (opts = {}) {
    const rate = pctToFrac(opts.rate, 30)
    const services = [
      { name: 'customer-entity-service', url: config.CUSTOMER_ENTITY_SERVICE_URL },
      { name: 'ops-entity-service', url: config.OPS_ENTITY_SERVICE_URL },
      { name: 'journey-service', url: config.JOURNEY_SERVICE_URL },
    ]
    
    const activations = []
    for (const s of services) {
      const res = await proxy.get(`${s.url}/api/v1/admin/fault-gates`)
      if (res.ok && res.data) {
        const gates = Object.keys(res.data)
        for (const gateName of gates) {
          activations.push(proxy.post(`${s.url}/api/v1/admin/fault-gates/${gateName}`, {
            enabled: true, rate,
          }))
        }
      }
    }
    await Promise.all(activations)
    return { ok: true, data: { message: 'business-exceptions activated' } }
  },
  async reset () {
    const services = [
      { name: 'customer-entity-service', url: config.CUSTOMER_ENTITY_SERVICE_URL },
      { name: 'ops-entity-service', url: config.OPS_ENTITY_SERVICE_URL },
      { name: 'journey-service', url: config.JOURNEY_SERVICE_URL },
    ]
    const resets = []
    for (const s of services) {
      const res = await proxy.get(`${s.url}/api/v1/admin/fault-gates`)
      if (res.ok && res.data) {
        const gates = Object.keys(res.data)
        for (const gateName of gates) {
          resets.push(proxy.post(`${s.url}/api/v1/admin/fault-gates/${gateName}`, {
            enabled: false, rate: 0,
          }))
        }
      }
    }
    await Promise.all(resets)
    return { ok: true, data: { message: 'business-exceptions reset' } }
  },
}

123|
124|const HIDDEN_SCENARIOS = new Set([
125|  ...Object.keys(SCENARIOS).filter(k => k.startsWith('biz-fault-'))
126|])
127|
128|function listScenarios () {
129|  return Object.entries(SCENARIOS)
130|    .filter(([id]) => !HIDDEN_SCENARIOS.has(id))
131|    .map(([id, s]) => ({
132|      id,
133|      name: s.name,
134|      description: s.description,
135|      clear: s.clear,
136|      params: s.params ?? [],
137|    }))
138|}
139|
140|async function activateScenario (id, opts = {}) {
141|  const scenario = SCENARIOS[id]
142|  if (!scenario) return { ok: false, error: `Unknown scenario '${id}'` }
143|
144|  const result = await scenario.activate(opts)
145|  if (!result || result.ok === false) {
146|    return { ok: false, error: result?.error || 'Failed to activate scenario' }
147|  }
148|
149|  const clearDefault = scenario.clear || { mode: 'manual', minutes: 5 }
150|  const mode = (opts.clear_mode === 'auto' || opts.clear_mode === 'manual')
151|    ? opts.clear_mode
152|    : clearDefault.mode
153|  const minutes = Number(opts.clear_minutes) > 0 ? Number(opts.clear_minutes) : clearDefault.minutes
154|  const autoResetMs = mode === 'auto' ? minutes * 60 * 1000 : null
155|
156|  state.setActiveScenario(id, scenario.name, autoResetMs, () => scenario.reset(), {
157|    ...opts, clear_mode: mode, clear_minutes: minutes,
158|  })
159|
160|  return {
161|    ok: true,
162|    scenario: {
163|      id,
164|      name: scenario.name,
165|      clear: { mode, minutes },
166|      params: opts,
167|      started_at: state.getActiveScenario()?.started_at,
168|    },
169|  }
170|}
171|
172|async function resetScenario (id) {
173|  const scenario = SCENARIOS[id]
174|  if (!scenario) return { ok: false, error: `Unknown scenario '${id}'` }
175|  return scenario.reset()
176|}
177|
178|async function resetAll () {
179|  const scenarioResets = Object.entries(SCENARIOS).map(([id, s]) =>
180|    s.reset().then(r => ({ id, ...r })).catch(e => ({ id, ok: false, error: e.message }))
181|  )
182|
183|  const results = await Promise.all(scenarioResets)
184|
185|  state.clearActiveScenario()
186|
187|  for (const key of Object.keys(state.getFaults())) {
188|    const currentFault = state.getFaults()[key]
189|    state.setFault(key, Object.keys(currentFault).map(k => [k, typeof currentFault[k] === 'number' ? 0 : false]))
190|  }
191|
192|  return results
193|}
194|
195|module.exports = { SCENARIOS, listScenarios, activateScenario, resetScenario, resetAll }
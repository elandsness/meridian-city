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
 *
 * Business-process exceptions (gated error branches that make the Dynatrace Business
 * Flows show process failures + conversion drop-off; default off, default manual clear):
 *   request-failures      — citizen-service: service_request.rejected at Validated
 *   account-failures      — citizen-service: account.verification_failed / .activation_failed
 *   incident-escalations  — city-operations: workorder.escalated at the resolution step
 *   checkout-declines     — commerce-service: checkout.payment_declined + order.delivery_failed
 *   tax-payment-failures  — billing-service: tax.payment_failed at the Payment step
 *   business-exceptions   — all five of the above at once (umbrella)
 */

const config = require('./config')
const proxy = require('./proxy')
const state = require('./state')

const CLEAR_MIN = 1
const CLEAR_MAX = 30

/** Convert a percent param (5–100) to a 0..1 fraction, falling back to a default percent. */
const pctToFrac = (v, def) => (Number(v) > 0 ? Number(v) : def) / 100

/** Shared shape for the per-flow failure-rate slider. */
const RATE_PARAM = { name: 'rate', label: 'Failure rate', min: 5, max: 100, step: 5, default: 30, unit: '%' }

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

  // --------------------------------------------------------------------------- //
  // Business-process exceptions — gated error branches for the Business Flows.
  // Off by default; an SE turns one on for a demo so Dynatrace surfaces the
  // process failure / conversion drop-off without polluting the happy-path funnels.
  // --------------------------------------------------------------------------- //

  'request-failures': {
    name: 'Service Request Rejections',
    description: 'Rejects a share of new service requests at validation, so the [Meridian] Service Request Lifecycle flow shows a service_request.rejected error branch + drop-off at the Validated step. Needs request traffic (Citizen-request journey).',
    clear: { mode: 'manual', minutes: 10, min: CLEAR_MIN, max: CLEAR_MAX },
    params: [RATE_PARAM],
    async activate (opts = {}) {
      const rate = pctToFrac(opts.rate, 30)
      const r = await proxy.post(`${config.CITIZEN_SERVICE_URL}/admin/fault`, {
        request_reject_enabled: true, request_reject_rate: rate,
      })
      state.setFault('citizen-service', { request_reject_enabled: true, request_reject_rate: rate })
      return r
    },
    async reset () {
      const r = await proxy.post(`${config.CITIZEN_SERVICE_URL}/admin/fault`, {
        request_reject_enabled: false, request_reject_rate: 0,
      })
      state.setFault('citizen-service', { request_reject_enabled: false, request_reject_rate: 0 })
      return r
    },
  },

  'account-failures': {
    name: 'Account Verification/Activation Failures',
    description: 'Fails verification/activation for a share of new accounts, so the [Meridian] Account Creation flow shows account.verification_failed / account.activation_failed error branches + drop-off at the Verified/Activated steps. Deferred steps land over the lifecycle bands, so failures appear minutes after signup.',
    clear: { mode: 'manual', minutes: 10, min: CLEAR_MIN, max: CLEAR_MAX },
    params: [RATE_PARAM],
    async activate (opts = {}) {
      const rate = pctToFrac(opts.rate, 30)
      const r = await proxy.post(`${config.CITIZEN_SERVICE_URL}/admin/fault`, {
        account_fail_enabled: true, account_fail_rate: rate,
      })
      state.setFault('citizen-service', { account_fail_enabled: true, account_fail_rate: rate })
      return r
    },
    async reset () {
      const r = await proxy.post(`${config.CITIZEN_SERVICE_URL}/admin/fault`, {
        account_fail_enabled: false, account_fail_rate: 0,
      })
      state.setFault('citizen-service', { account_fail_enabled: false, account_fail_rate: 0 })
      return r
    },
  },

  'incident-escalations': {
    name: 'IoT Incident Escalations',
    description: 'Escalates a share of acknowledged work orders instead of resolving them, so the [Meridian] IoT Incident Resolution flow shows a workorder.escalated error branch + drop-off at the resolution step. Driven by the IoT anomaly pipeline.',
    clear: { mode: 'manual', minutes: 10, min: CLEAR_MIN, max: CLEAR_MAX },
    params: [RATE_PARAM],
    async activate (opts = {}) {
      const rate = pctToFrac(opts.rate, 30)
      const r = await proxy.post(`${config.CITY_OPERATIONS_URL}/admin/fault`, {
        type: 'workorder-escalation', enabled: true, rate,
      })
      state.setFault('city-operations', { workorder_escalation_enabled: true, workorder_escalation_rate: rate })
      return r
    },
    async reset () {
      const r = await proxy.post(`${config.CITY_OPERATIONS_URL}/admin/fault`, {
        type: 'workorder-escalation', enabled: false, rate: 0,
      })
      state.setFault('city-operations', { workorder_escalation_enabled: false, workorder_escalation_rate: 0 })
      return r
    },
  },

  'checkout-declines': {
    name: 'Store Checkout Declines',
    description: 'Declines a share of checkouts and fails the same share of deliveries, so the [Meridian] City Store Purchase flow shows checkout.payment_declined + order.delivery_failed error branches + drop-off at the Checkout and Delivered steps. Needs store traffic (Store-purchase journey).',
    clear: { mode: 'manual', minutes: 10, min: CLEAR_MIN, max: CLEAR_MAX },
    params: [RATE_PARAM],
    async activate (opts = {}) {
      const rate = pctToFrac(opts.rate, 30)
      const r = await proxy.post(`${config.COMMERCE_SERVICE_URL}/admin/fault`, {
        type: 'checkout-failures', enabled: true, rate,
      })
      state.setFault('commerce-service', { checkout_failures_enabled: true, checkout_failures_rate: rate })
      return r
    },
    async reset () {
      const r = await proxy.post(`${config.COMMERCE_SERVICE_URL}/admin/fault`, {
        type: 'checkout-failures', enabled: false, rate: 0,
      })
      state.setFault('commerce-service', { checkout_failures_enabled: false, checkout_failures_rate: 0 })
      return r
    },
  },

  'tax-payment-failures': {
    name: 'Tax Payment Failures',
    description: 'Fails a share of tax-bill payments at the gateway (bill stays outstanding), so the [Meridian] Tax Payment flow shows a tax.payment_failed error branch + drop-off at the Payment step. Needs tax traffic (Pay-tax journey).',
    clear: { mode: 'manual', minutes: 10, min: CLEAR_MIN, max: CLEAR_MAX },
    params: [RATE_PARAM],
    async activate (opts = {}) {
      const rate = pctToFrac(opts.rate, 30)
      const r = await proxy.post(`${config.BILLING_SERVICE_URL}/admin/fault`, {
        payment_fail_enabled: true, payment_fail_rate: rate,
      })
      state.setFault('billing-service', { payment_fail_enabled: true, payment_fail_rate: rate })
      return r
    },
    async reset () {
      const r = await proxy.post(`${config.BILLING_SERVICE_URL}/admin/fault`, {
        payment_fail_enabled: false, payment_fail_rate: 0,
      })
      state.setFault('billing-service', { payment_fail_enabled: false, payment_fail_rate: 0 })
      return r
    },
  },

  'business-exceptions': {
    name: 'Business Failures',
    description: 'Inject business-process failures across every active business flow at one shared rate — Dynatrace surfaces the failure branch + conversion drop-off wherever traffic is flowing. One toggle + one rate for all flows (replaces the old per-flow failure scenarios).',
    clear: { mode: 'manual', minutes: 10, min: CLEAR_MIN, max: CLEAR_MAX },
    params: [RATE_PARAM],
    async activate (opts = {}) {
      await SCENARIOS['request-failures'].activate(opts)
      await SCENARIOS['account-failures'].activate(opts)
      await SCENARIOS['incident-escalations'].activate(opts)
      await SCENARIOS['checkout-declines'].activate(opts)
      await SCENARIOS['tax-payment-failures'].activate(opts)
      return { ok: true, data: { message: 'business-exceptions activated' } }
    },
    async reset () {
      await SCENARIOS['request-failures'].reset()
      await SCENARIOS['account-failures'].reset()
      await SCENARIOS['incident-escalations'].reset()
      await SCENARIOS['checkout-declines'].reset()
      await SCENARIOS['tax-payment-failures'].reset()
      return { ok: true, data: { message: 'business-exceptions reset' } }
    },
  },
}

// The per-flow failure scenarios are folded into the single 'business-exceptions'
// control (one toggle + rate for all flows). They stay defined as internal building
// blocks the umbrella calls, but are hidden from the catalog so operators use the one
// unified control instead of toggling failures a flow at a time. Making a new
// industry's flow failable means wiring its service into 'business-exceptions', not
// adding (and re-skinning) another per-flow scenario.
const HIDDEN_SCENARIOS = new Set([
  'request-failures',
  'account-failures',
  'incident-escalations',
  'checkout-declines',
  'tax-payment-failures',
])

/**
 * Return metadata for the catalog scenarios (hidden building-block scenarios excluded).
 */
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

'use strict'

/**
 * Fault injection routes.
 *
 * POST /api/v1/fault/:service   — inject a fault into a specific service
 * GET  /api/v1/fault/status     — current fault state across all services
 * POST /api/v1/fault/reset-all  — clear all active faults
 *
 * Supported services:
 *   ai-service           { llm_latency_enabled, llm_latency_seconds }
 *   citizen-service      { db_slowdown_enabled, db_slowdown_seconds }
 *   city-operations      { db_slowdown_enabled, db_slowdown_seconds }
 *   analytics-service    { db_slowdown_enabled, db_slowdown_seconds, memory_pressure_enabled }
 *   telemetry-processor  { memory_pressure_enabled }
 */

const config = require('../config')
const proxy = require('../proxy')
const { getFaults, setFault } = require('../state')

const SERVICE_URLS = {
  'ai-service':          config.AI_SERVICE_URL,
  'citizen-service':     config.CITIZEN_SERVICE_URL,
  'city-operations':     config.CITY_OPERATIONS_URL,
  'analytics-service':   config.ANALYTICS_SERVICE_URL,
  'telemetry-processor': config.TELEMETRY_PROCESSOR_URL,
}

/**
 * @param {import('fastify').FastifyInstance} fastify
 */
async function faultRoutes (fastify) {
  // GET /api/v1/fault/status
  fastify.get('/api/v1/fault/status', async (_request, reply) => {
    return reply.send({ faults: getFaults() })
  })

  // POST /api/v1/fault/:service
  fastify.post('/api/v1/fault/:service', async (request, reply) => {
    const { service } = request.params
    const body = request.body || {}

    const url = SERVICE_URLS[service]
    if (!url) {
      return reply.status(404).send({
        error: `Unknown service '${service}'. Supported: ${Object.keys(SERVICE_URLS).join(', ')}`,
      })
    }

    const result = await proxy.post(`${url}/admin/fault`, body)
    setFault(service, body)

    return reply.status(result.ok ? 200 : 502).send({
      service,
      result: result.data,
      ok: result.ok,
      error: result.error,
    })
  })

  // POST /api/v1/fault/reset-all
  fastify.post('/api/v1/fault/reset-all', async (_request, reply) => {
    const resets = await Promise.allSettled([
      proxy.post(`${config.AI_SERVICE_URL}/admin/fault`,          { llm_latency_enabled: false }),
      proxy.post(`${config.CITIZEN_SERVICE_URL}/admin/fault`,     { db_slowdown_enabled: false }),
      proxy.post(`${config.CITY_OPERATIONS_URL}/admin/fault`,     { db_slowdown_enabled: false }),
      proxy.post(`${config.ANALYTICS_SERVICE_URL}/admin/fault`,   { db_slowdown_enabled: false, memory_pressure_enabled: false }),
      proxy.post(`${config.TELEMETRY_PROCESSOR_URL}/admin/fault`, { memory_pressure_enabled: false }),
    ])

    // Update local state
    setFault('ai-service',          { llm_latency_enabled: false, llm_latency_seconds: 0 })
    setFault('citizen-service',     { db_slowdown_enabled: false, db_slowdown_seconds: 0 })
    setFault('city-operations',     { db_slowdown_enabled: false, db_slowdown_seconds: 0 })
    setFault('analytics-service',   { db_slowdown_enabled: false, db_slowdown_seconds: 0, memory_pressure_enabled: false })
    setFault('telemetry-processor', { memory_pressure_enabled: false })

    const results = resets.map((r, i) => ({
      service: Object.keys(SERVICE_URLS)[i],
      ok: r.status === 'fulfilled' && r.value.ok,
    }))

    return reply.send({ reset: true, results })
  })
}

module.exports = faultRoutes

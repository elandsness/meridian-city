'use strict'

/**
 * Traffic bot control routes.
 *
 * GET  /api/v1/traffic/status         — current traffic bot state
 * POST /api/v1/traffic/start          — start the traffic bot
 * POST /api/v1/traffic/stop           — stop the traffic bot
 * POST /api/v1/traffic/burst          — 10× load burst for N minutes (?duration_minutes=2)
 * POST /api/v1/traffic/scenario       — run a specific citizen journey pattern
 * POST /api/v1/traffic/journey        — enable/disable a journey at runtime { name, enabled }
 *
 * All commands forward to the traffic-bot service.
 */

const config = require('../config')
const proxy = require('../proxy')
const { getTrafficState, setTrafficState } = require('../state')

/**
 * @param {import('fastify').FastifyInstance} fastify
 */
async function trafficRoutes (fastify) {
  // GET /api/v1/traffic/status
  fastify.get('/api/v1/traffic/status', async (_request, reply) => {
    const live = await proxy.get(`${config.TRAFFIC_BOT_URL}/api/v1/status`)
    if (live.ok) return reply.send(live.data)
    return reply.send({
      ...getTrafficState(),
      source: 'local-cache',
      warning: 'traffic-bot unreachable',
    })
  })

  // POST /api/v1/traffic/start
  fastify.post('/api/v1/traffic/start', async (_request, reply) => {
    const result = await proxy.post(`${config.TRAFFIC_BOT_URL}/api/v1/start`, {})
    setTrafficState({ running: true })
    return reply.status(result.ok ? 200 : 502).send({ ok: result.ok, result: result.data, error: result.error })
  })

  // POST /api/v1/traffic/stop
  fastify.post('/api/v1/traffic/stop', async (_request, reply) => {
    const result = await proxy.post(`${config.TRAFFIC_BOT_URL}/api/v1/stop`, {})
    setTrafficState({ running: false, burst_active: false, burst_until: null })
    return reply.status(result.ok ? 200 : 502).send({ ok: result.ok, result: result.data, error: result.error })
  })

  // POST /api/v1/traffic/burst
  fastify.post('/api/v1/traffic/burst', async (request, reply) => {
    const duration_minutes = parseInt(request.body?.duration_minutes || '2', 10)
    const result = await proxy.post(`${config.TRAFFIC_BOT_URL}/api/v1/burst`, { duration_minutes })

    const burst_until = new Date(Date.now() + duration_minutes * 60_000).toISOString()
    setTrafficState({ running: true, burst_active: true, burst_until })

    return reply.status(result.ok ? 200 : 502).send({
      ok: result.ok,
      burst_until,
      result: result.data,
      error: result.error,
    })
  })

  // POST /api/v1/traffic/scenario
  fastify.post('/api/v1/traffic/scenario', async (request, reply) => {
    const { scenario } = request.body || {}
    if (!scenario) {
      return reply.status(400).send({ error: 'scenario is required' })
    }
    const result = await proxy.post(`${config.TRAFFIC_BOT_URL}/api/v1/scenario`, { scenario })
    return reply.status(result.ok ? 200 : 502).send({ ok: result.ok, scenario, result: result.data, error: result.error })
  })

  // POST /api/v1/traffic/journey — enable/disable a journey at runtime (e.g. chat traffic)
  fastify.post('/api/v1/traffic/journey', async (request, reply) => {
    const { name, enabled } = request.body || {}
    if (!name || typeof enabled !== 'boolean') {
      return reply.status(400).send({ error: 'name (string) and enabled (boolean) are required' })
    }
    const result = await proxy.post(`${config.TRAFFIC_BOT_URL}/api/v1/journey`, { name, enabled })
    return reply.status(result.ok ? 200 : 502).send({ ok: result.ok, name, enabled, result: result.data, error: result.error })
  })
}

module.exports = trafficRoutes

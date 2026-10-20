'use strict'

/**
 * IoT device fleet routes — thin proxy onto the iot-simulator's admin API
 * (services/iot-simulator/internal/admin/server.go), for a future UI to wire
 * up device CRUD and ongoing fault-gate problem injection.
 *
 * GET    /api/v1/iot/device-types         — configured device types/hierarchy/metrics
 * GET    /api/v1/iot/devices              — list devices (optional ?type=)
 * POST   /api/v1/iot/devices              — add device(s): { type, count, parent_id }
 * DELETE /api/v1/iot/devices/:id          — remove a device (cascades to children)
 * GET    /api/v1/iot/fault-gates          — list active fault gates by device type
 * PUT    /api/v1/iot/fault-gates/:type    — set an ongoing fault gate
 * DELETE /api/v1/iot/fault-gates/:type    — disable/clear a fault gate
 */

const config = require('../config')
const proxy = require('../proxy')

/**
 * @param {import('fastify').FastifyInstance} fastify
 */
async function iotRoutes (fastify) {
  fastify.get('/api/v1/iot/device-types', async (_request, reply) => {
    const result = await proxy.get(`${config.IOT_SIMULATOR_URL}/api/v1/iot/device-types`)
    return reply.status(result.ok ? 200 : 502).send(result.data)
  })

  fastify.get('/api/v1/iot/devices', async (request, reply) => {
    const qs = request.query?.type ? `?type=${encodeURIComponent(request.query.type)}` : ''
    const result = await proxy.get(`${config.IOT_SIMULATOR_URL}/api/v1/iot/devices${qs}`)
    return reply.status(result.ok ? 200 : 502).send(result.data)
  })

  fastify.post('/api/v1/iot/devices', async (request, reply) => {
    const { type, count, parent_id: parentId } = request.body || {}
    if (!type) {
      return reply.status(400).send({ error: 'type is required' })
    }
    const result = await proxy.post(`${config.IOT_SIMULATOR_URL}/api/v1/iot/devices`, {
      type, count: count || 1, parent_id: parentId || '',
    })
    return reply.status(result.ok ? 201 : 502).send(result.data)
  })

  fastify.delete('/api/v1/iot/devices/:id', async (request, reply) => {
    const result = await proxy.del(`${config.IOT_SIMULATOR_URL}/api/v1/iot/devices/${encodeURIComponent(request.params.id)}`)
    return reply.status(result.ok ? 200 : 404).send({ ok: result.ok })
  })

  fastify.get('/api/v1/iot/fault-gates', async (_request, reply) => {
    const result = await proxy.get(`${config.IOT_SIMULATOR_URL}/api/v1/iot/fault-gates`)
    return reply.status(result.ok ? 200 : 502).send(result.data)
  })

  fastify.put('/api/v1/iot/fault-gates/:type', async (request, reply) => {
    const result = await proxy.put(
      `${config.IOT_SIMULATOR_URL}/api/v1/iot/fault-gates/${encodeURIComponent(request.params.type)}`,
      request.body || {}
    )
    return reply.status(result.ok ? 200 : 502).send(result.data)
  })

  fastify.delete('/api/v1/iot/fault-gates/:type', async (request, reply) => {
    const result = await proxy.del(`${config.IOT_SIMULATOR_URL}/api/v1/iot/fault-gates/${encodeURIComponent(request.params.type)}`)
    return reply.status(result.ok ? 200 : 502).send({ ok: result.ok })
  })
}

module.exports = iotRoutes

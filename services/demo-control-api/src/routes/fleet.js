'use strict'

/**
 * Fleet management routes.
 *
 * GET  /api/v1/fleet/status          — current fleet size + anomaly state
 * POST /api/v1/fleet/resize          — change device count per category
 * POST /api/v1/fleet/anomaly         — inject an anomaly on a specific device
 * DELETE /api/v1/fleet/anomaly       — clear all active device anomalies
 *
 * All commands are forwarded to the iot-simulator service.
 */

const config = require('../config')
const proxy = require('../proxy')
const { getFleet, setFleetCount, setFleetAnomaly, clearFleetAnomalies } = require('../state')

/**
 * @param {import('fastify').FastifyInstance} fastify
 */
async function fleetRoutes (fastify) {
  // GET /api/v1/fleet/status
  fastify.get('/api/v1/fleet/status', async (_request, reply) => {
    // Try to get live status from iot-simulator
    const live = await proxy.get(`${config.IOT_SIMULATOR_URL}/api/v1/fleet/status`)
    if (live.ok) {
      return reply.send(live.data)
    }
    // Fallback to local state cache
    return reply.send({
      fleet: getFleet(),
      source: 'local-cache',
      warning: 'iot-simulator unreachable',
    })
  })

  // POST /api/v1/fleet/resize
  fastify.post('/api/v1/fleet/resize', async (request, reply) => {
    const { vehicles, buildings, machines } = request.body || {}

    const result = await proxy.post(`${config.IOT_SIMULATOR_URL}/api/v1/fleet/resize`, {
      vehicles, buildings, machines,
    })

    // Update local state regardless (optimistic)
    if (typeof vehicles === 'number') setFleetCount('vehicles', vehicles)
    if (typeof buildings === 'number') setFleetCount('buildings', buildings)
    if (typeof machines === 'number') setFleetCount('machines', machines)

    return reply.status(result.ok ? 200 : 502).send({
      ok: result.ok,
      fleet: getFleet(),
      result: result.data,
      error: result.error,
    })
  })

  // POST /api/v1/fleet/anomaly
  fastify.post('/api/v1/fleet/anomaly', async (request, reply) => {
    const { category, device_id, anomaly_type } = request.body || {}

    if (!category || !device_id) {
      return reply.status(400).send({ error: 'category and device_id are required' })
    }

    const result = await proxy.post(`${config.IOT_SIMULATOR_URL}/api/v1/fleet/anomaly`, {
      category, device_id, anomaly_type: anomaly_type || 'generic',
    })

    setFleetAnomaly(category, device_id)

    return reply.status(result.ok ? 200 : 502).send({
      ok: result.ok,
      category,
      device_id,
      result: result.data,
      error: result.error,
    })
  })

  // DELETE /api/v1/fleet/anomaly
  fastify.delete('/api/v1/fleet/anomaly', async (_request, reply) => {
    const result = await proxy.del(`${config.IOT_SIMULATOR_URL}/api/v1/fleet/anomaly`)
    clearFleetAnomalies()

    return reply.status(result.ok ? 200 : 502).send({
      ok: result.ok,
      anomalies_cleared: true,
      error: result.error,
    })
  })
}

module.exports = fleetRoutes

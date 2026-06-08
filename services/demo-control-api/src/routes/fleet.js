'use strict'

/**
 * Fleet management routes.
 *
 * GET    /api/v1/fleet/status   — current fleet size + anomaly state
 * POST   /api/v1/fleet/resize   — change device count per category
 * POST   /api/v1/fleet/anomaly  — inject an anomaly on a specific device
 * DELETE /api/v1/fleet/anomaly  — clear all active device anomalies
 *
 * All commands are forwarded to the iot-simulator service, whose admin API is:
 *   GET    /admin/fleet                 — fleet status
 *   POST   /admin/fleet {vehicles,buildings,machines}  — resize (absolute counts)
 *   POST   /admin/anomaly {device_id,type,enabled}     — set/clear one device
 *   DELETE /admin/anomaly/{device_id}                  — clear one device
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
    const live = await proxy.get(`${config.IOT_SIMULATOR_URL}/admin/fleet`)
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
  // The simulator interprets the counts as absolute and sets each category to
  // exactly the value received (a missing field decodes to 0 and would stop all
  // devices in that category). So we always send the full triple, filling any
  // omitted category from the last known count.
  fastify.post('/api/v1/fleet/resize', async (request, reply) => {
    const body = request.body || {}
    const current = getFleet()
    const payload = {
      vehicles:  typeof body.vehicles  === 'number' ? body.vehicles  : current.vehicles.count,
      buildings: typeof body.buildings === 'number' ? body.buildings : current.buildings.count,
      machines:  typeof body.machines  === 'number' ? body.machines  : current.machines.count,
    }

    const result = await proxy.post(`${config.IOT_SIMULATOR_URL}/admin/fleet`, payload)

    if (result.ok) {
      setFleetCount('vehicles', payload.vehicles)
      setFleetCount('buildings', payload.buildings)
      setFleetCount('machines', payload.machines)
    }

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

    if (!device_id) {
      return reply.status(400).send({ error: 'device_id is required' })
    }

    const result = await proxy.post(`${config.IOT_SIMULATOR_URL}/admin/anomaly`, {
      device_id,
      type: anomaly_type || 'generic',
      enabled: true,
    })

    if (result.ok && category) {
      setFleetAnomaly(category, device_id)
    }

    return reply.status(result.ok ? 200 : 502).send({
      ok: result.ok,
      category,
      device_id,
      result: result.data,
      error: result.error,
    })
  })

  // DELETE /api/v1/fleet/anomaly — clear every tracked device anomaly.
  // The simulator clears anomalies one device at a time, so we issue one
  // DELETE per device id currently recorded as anomalous.
  fastify.delete('/api/v1/fleet/anomaly', async (_request, reply) => {
    const fleet = getFleet()
    const deviceIds = Object.values(fleet)
      .map((c) => c.anomaly_device_id)
      .filter(Boolean)

    const results = await Promise.all(
      deviceIds.map((id) =>
        proxy.del(`${config.IOT_SIMULATOR_URL}/admin/anomaly/${encodeURIComponent(id)}`)
      )
    )
    clearFleetAnomalies()

    const ok = results.every((r) => r.ok) // true when there was nothing to clear
    return reply.status(200).send({
      ok,
      anomalies_cleared: deviceIds.length,
      error: ok ? undefined : 'one or more device anomaly clears failed',
    })
  })
}

module.exports = fleetRoutes

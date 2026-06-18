'use strict'

/**
 * Fleet management routes — orchestrate the iot-simulator's admin API.
 *
 * GET    /api/v1/fleet/status   — current fleet counts + active anomalies
 * POST   /api/v1/fleet/resize   — change device count per category
 * POST   /api/v1/fleet/anomaly  — inject an anomaly on a specific device
 * DELETE /api/v1/fleet/anomaly  — clear all active device anomalies
 *
 * The simulator serves these at /admin/fleet and /admin/anomaly[/{id}] (NOT
 * /api/v1/fleet/*), and its anomaly body is { device_id, type, enabled }. Its
 * fleet status is { <cat>: { count, anomalies } }; we flatten it to the
 * { vehicles, buildings, machines } numbers the dashboard expects.
 */

const config = require('../config')
const proxy = require('../proxy')
const { getFleet, setFleetCount, setFleetAnomaly, clearFleetAnomalies } = require('../state')
const { resolveAnomalyType, clearAllFleetAnomalies } = require('../fleetOps')

// Flatten the simulator's { vehicles:{count,anomalies}, ... } into flat counts
// plus a merged anomalies map, matching what the dashboard reads.
function shapeStatus (simStatus) {
  const d = simStatus || {}
  return {
    vehicles: d.vehicles?.count ?? 0,
    buildings: d.buildings?.count ?? 0,
    machines: d.machines?.count ?? 0,
    anomalies: {
      ...(d.vehicles?.anomalies || {}),
      ...(d.buildings?.anomalies || {}),
      ...(d.machines?.anomalies || {}),
    },
  }
}

/**
 * @param {import('fastify').FastifyInstance} fastify
 */
async function fleetRoutes (fastify) {
  // GET /api/v1/fleet/status
  fastify.get('/api/v1/fleet/status', async (_request, reply) => {
    const live = await proxy.get(`${config.IOT_SIMULATOR_URL}/admin/fleet`)
    if (live.ok) {
      return reply.send({ ...shapeStatus(live.data), source: 'iot-simulator' })
    }
    // Fallback to local state cache (flat counts so the UI still renders).
    const f = getFleet()
    return reply.send({
      vehicles: f.vehicles.count,
      buildings: f.buildings.count,
      machines: f.machines.count,
      anomalies: {},
      source: 'local-cache',
      warning: 'iot-simulator unreachable',
    })
  })

  // POST /api/v1/fleet/resize
  fastify.post('/api/v1/fleet/resize', async (request, reply) => {
    const { vehicles, buildings, machines } = request.body || {}

    const result = await proxy.post(`${config.IOT_SIMULATOR_URL}/admin/fleet`, {
      vehicles, buildings, machines,
    })

    // Update local state optimistically.
    if (typeof vehicles === 'number') setFleetCount('vehicles', vehicles)
    if (typeof buildings === 'number') setFleetCount('buildings', buildings)
    if (typeof machines === 'number') setFleetCount('machines', machines)

    return reply.status(result.ok ? 200 : 502).send({
      ok: result.ok,
      fleet: result.ok ? shapeStatus(result.data) : getFleet(),
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

    const type = resolveAnomalyType(category, anomaly_type)
    if (!type) {
      return reply.status(400).send({
        error: `unsupported anomaly_type '${anomaly_type}' for category '${category}'`,
      })
    }
    const result = await proxy.post(`${config.IOT_SIMULATOR_URL}/admin/anomaly`, {
      device_id,
      type,
      enabled: true,
    })

    if (result.ok) setFleetAnomaly(category, device_id)

    return reply.status(result.ok ? 200 : 502).send({
      ok: result.ok,
      category,
      device_id,
      anomaly_type: type,
      result: result.data,
      // Surface a useful hint when the simulator rejects the device id (404).
      error: result.ok ? undefined : (result.error || result.data?.error),
    })
  })

  // DELETE /api/v1/fleet/anomaly — clear every active anomaly
  fastify.delete('/api/v1/fleet/anomaly', async (_request, reply) => {
    const res = await clearAllFleetAnomalies()
    clearFleetAnomalies()
    return reply.status(res.ok ? 200 : 502).send({
      ok: res.ok,
      anomalies_cleared: res.cleared,
      errors: res.errors,
      error: res.error,
    })
  })
}

module.exports = fleetRoutes

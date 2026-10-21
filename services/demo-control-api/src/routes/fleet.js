'use strict'

/**
 * Generic IoT fleet status/resize routes for Demo Control's Fleet panel.
 * Thin aggregation on top of iot-simulator's generic, config-driven device-type
 * API (routes/iot.js's plain passthrough) -- iot-simulator has no notion of a
 * fixed "vehicle/building/machine" vocabulary (it's whatever `industry.iot.
 * deviceTypes` declares), so this builds a per-type current-count view and a
 * generic add/remove resize on top of its device CRUD endpoints, instead of
 * assuming any fixed set of categories.
 *
 * GET  /api/v1/fleet/status          — device types + current counts
 * POST /api/v1/fleet/resize          — { type, count } set one type's population
 */

const config = require('../config')
const proxy = require('../proxy')

async function fleetRoutes (fastify) {
  fastify.get('/api/v1/fleet/status', async (_request, reply) => {
    const [typesResult, devicesResult] = await Promise.all([
      proxy.get(`${config.IOT_SIMULATOR_URL}/api/v1/iot/device-types`),
      proxy.get(`${config.IOT_SIMULATOR_URL}/api/v1/iot/devices`),
    ])

    if (!typesResult.ok) {
      return reply.status(502).send({ error: 'iot-simulator unreachable', deviceTypes: [] })
    }

    const deviceTypes = typesResult.data?.device_types ?? []
    const devices = devicesResult.ok ? (devicesResult.data?.items ?? []) : []

    const countByType = {}
    for (const d of devices) countByType[d.type] = (countByType[d.type] || 0) + 1

    return reply.send({
      deviceTypes: deviceTypes.map((t) => ({
        type: t.type,
        displayName: t.displayName || t.type,
        configuredCount: t.count ?? 0,
        currentCount: countByType[t.type] || 0,
      })),
    })
  })

  // Resize one device type's population to an exact count. iot-simulator only
  // exposes additive "add N" / single "remove by id" -- this computes the
  // delta against the live count and does the add or the N removals.
  fastify.post('/api/v1/fleet/resize', async (request, reply) => {
    const { type, count } = request.body || {}
    if (!type || typeof count !== 'number' || count < 0) {
      return reply.status(400).send({ error: 'type (string) and count (non-negative number) are required' })
    }

    const listResult = await proxy.get(`${config.IOT_SIMULATOR_URL}/api/v1/iot/devices?type=${encodeURIComponent(type)}`)
    if (!listResult.ok) {
      return reply.status(502).send({ ok: false, error: 'iot-simulator unreachable' })
    }
    const current = listResult.data?.items ?? []
    const delta = count - current.length

    if (delta > 0) {
      const result = await proxy.post(`${config.IOT_SIMULATOR_URL}/api/v1/iot/devices`, { type, count: delta })
      return reply.status(result.ok ? 200 : 502).send({ ok: result.ok, added: delta, error: result.error })
    }
    if (delta < 0) {
      const toRemove = current.slice(0, -delta)
      const results = await Promise.all(
        toRemove.map((d) => proxy.del(`${config.IOT_SIMULATOR_URL}/api/v1/iot/devices/${encodeURIComponent(d.id)}`))
      )
      const removed = results.filter((r) => r.ok).length
      return reply.send({ ok: removed === toRemove.length, removed })
    }
    return reply.send({ ok: true, added: 0, removed: 0 })
  })
}

module.exports = fleetRoutes

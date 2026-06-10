'use strict'

/**
 * Scenario orchestration routes.
 *
 * GET    /api/v1/scenarios               — list all available scenarios
 * GET    /api/v1/scenarios/active        — currently active scenario (if any)
 * POST   /api/v1/scenarios/:id/start     — activate a scenario
 * DELETE /api/v1/scenarios/active        — reset active scenario + clear all faults
 * POST   /api/v1/scenarios/reset-all     — reset all scenarios + faults + IoT anomalies
 */

const { getActiveScenario, clearActiveScenario } = require('../state')
const { listScenarios, activateScenario, resetAll } = require('../scenarios')
const { clearAllFleetAnomalies } = require('../fleetOps')

/**
 * @param {import('fastify').FastifyInstance} fastify
 */
async function scenarioRoutes (fastify) {
  // GET /api/v1/scenarios
  fastify.get('/api/v1/scenarios', async (_request, reply) => {
    return reply.send({ scenarios: listScenarios() })
  })

  // GET /api/v1/scenarios/active
  fastify.get('/api/v1/scenarios/active', async (_request, reply) => {
    const active = getActiveScenario()
    if (!active) return reply.send({ active: null })
    return reply.send({ active })
  })

  // POST /api/v1/scenarios/:id/start
  fastify.post('/api/v1/scenarios/:id/start', async (request, reply) => {
    const { id } = request.params
    const result = await activateScenario(id)
    if (!result.ok && result.error) {
      return reply.status(404).send({ error: result.error })
    }
    return reply.send(result)
  })

  // DELETE /api/v1/scenarios/active
  fastify.delete('/api/v1/scenarios/active', async (_request, reply) => {
    const active = getActiveScenario()
    if (!active) {
      return reply.send({ reset: true, message: 'no active scenario' })
    }

    const { resetScenario } = require('../scenarios')
    await resetScenario(active.id).catch(() => {})
    clearActiveScenario()

    return reply.send({ reset: true, cleared: active.name })
  })

  // POST /api/v1/scenarios/reset-all — nuclear reset: all faults + IoT anomalies
  fastify.post('/api/v1/scenarios/reset-all', async (_request, reply) => {
    const [faultResults] = await Promise.allSettled([resetAll()])

    // Also clear IoT anomalies via the iot-simulator (per-device clears under
    // /admin/anomaly/{id}); see fleetOps.clearAllFleetAnomalies.
    const anomalyReset = await clearAllFleetAnomalies().catch(() => ({ ok: false, cleared: [] }))

    return reply.send({
      reset: true,
      faults_reset: faultResults.status === 'fulfilled' ? faultResults.value : [],
      anomalies_cleared: anomalyReset.cleared ?? [],
    })
  })
}

module.exports = scenarioRoutes

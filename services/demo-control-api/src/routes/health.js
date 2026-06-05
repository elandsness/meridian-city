'use strict'

const { hasActiveFaults, getActiveScenario, getFleet, getTrafficState } = require('../state')

/**
 * @param {import('fastify').FastifyInstance} fastify
 */
async function healthRoutes (fastify) {
  fastify.get('/health', async (_request, reply) => {
    return reply.send({
      status: 'ok',
      service: 'demo-control-api',
      active_faults: hasActiveFaults(),
      active_scenario: getActiveScenario()?.name || null,
    })
  })

  fastify.get('/api/v1/status', async (_request, reply) => {
    return reply.send({
      service: 'demo-control-api',
      active_faults: hasActiveFaults(),
      faults: require('../state').getFaults(),
      active_scenario: getActiveScenario(),
      fleet: getFleet(),
      traffic: getTrafficState(),
    })
  })
}

module.exports = healthRoutes

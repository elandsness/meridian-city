'use strict'

/**
 * Command Center aggregation route.
 *
 * GET /api/v1/command-center — cross-service snapshot for the ops-dashboard
 * Command Center page: business-flow volume/health, traffic, and active
 * failure scenarios/fault gates. See commandCenter.js for how it's assembled.
 */

const { getCommandCenterStatus } = require('../commandCenter')

/**
 * @param {import('fastify').FastifyInstance} fastify
 */
async function commandCenterRoutes (fastify) {
  fastify.get('/api/v1/command-center', async (_request, reply) => {
    return reply.send(await getCommandCenterStatus())
  })
}

module.exports = commandCenterRoutes

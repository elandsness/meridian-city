'use strict'

const config = require('../config')
const proxy = require('../proxy')
const { hasActiveFaults, getActiveScenario, getTrafficState } = require('../state')

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
    const iotFaultGates = await proxy.get(`${config.IOT_SIMULATOR_URL}/api/v1/iot/fault-gates`)
    return reply.send({
      service: 'demo-control-api',
      active_faults: hasActiveFaults(),
      faults: require('../state').getFaults(),
      active_scenario: getActiveScenario(),
      iot_fault_gates: iotFaultGates.ok ? iotFaultGates.data?.gates ?? {} : {},
      traffic: getTrafficState(),
    })
  })
}

module.exports = healthRoutes

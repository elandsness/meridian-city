'use strict'

const { request: undiciRequest } = require('undici')

async function healthRoutes (fastify, opts) {
  const config = opts.config

  const backendServices = [
    { name: 'citizen-service', url: `${config.CITIZEN_SERVICE_URL}/actuator/health` },
    { name: 'service-dispatch', url: `${config.SERVICE_DISPATCH_URL}/actuator/health` },
    { name: 'city-operations', url: `${config.CITY_OPERATIONS_URL}/actuator/health` },
    { name: 'analytics-service', url: `${config.ANALYTICS_SERVICE_URL}/health` },
    { name: 'ai-service', url: `${config.AI_SERVICE_URL}/health` },
    { name: 'notification-service', url: `${config.NOTIFICATION_SERVICE_URL}/health` },
  ]

  async function pingService (service) {
    try {
      const { statusCode } = await undiciRequest(service.url, {
        method: 'GET',
        headersTimeout: 3000,
        bodyTimeout: 3000,
      })
      return { name: service.name, status: statusCode >= 200 && statusCode < 300 ? 'ok' : 'error' }
    } catch (_err) {
      return { name: service.name, status: 'error' }
    }
  }

  fastify.get('/health', async (_request, reply) => {
    const results = await Promise.all(backendServices.map(pingService))

    const services = {}
    let degraded = false

    for (const result of results) {
      services[result.name] = result.status
      if (result.status !== 'ok') {
        degraded = true
      }
    }

    return reply.code(200).send({
      status: degraded ? 'degraded' : 'ok',
      version: '1.0.0',
      services,
    })
  })
}

module.exports = healthRoutes

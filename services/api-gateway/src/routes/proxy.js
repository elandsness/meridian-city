"use strict"

const { request: undiciRequest } = require('undici')
const { v4: uuidv4 } = require('uuid')
const semanticRoutes = require('./semantic-routes.json')

class RouteResolver {
  constructor(config) {
    this.config = config;
    
    this.systemRoutes = [
      {
        prefix: '/api/v1/auth',
        target: config.IDENTITY_SERVICE_URL,
        serviceName: 'identity-service',
        requiresAuth: false,
      },
      {
        prefix: '/api/v1/identity',
        target: config.IDENTITY_SERVICE_URL,
        serviceName: 'identity-service',
        requiresAuth: false,
      },
      {
        prefix: '/api/v1/workflow',
        target: config.WORKFLOW_SERVICE_URL,
        serviceName: 'workflow-service',
        requiresAuth: false,
      },
      {
        prefix: '/api/v1/transaction',
        target: config.TRANSACTION_SERVICE_URL,
        serviceName: 'transaction-service',
        requiresAuth: false,
      },
      {
        prefix: '/api/v1/journeys',
        target: config.JOURNEY_SERVICE_URL,
        serviceName: 'journey-service',
        requiresAuth: false,
      },
      {
        prefix: '/api/v1/iot',
        target: config.IOT_SIMULATOR_URL,
        serviceName: 'iot-simulator',
        requiresAuth: false,
      },
      {
        prefix: '/api/v1/chat',
        target: config.AI_SERVICE_URL,
        serviceName: 'ai-service',
        requiresAuth: false,
      },
      {
        prefix: '/api/v1/news',
        target: config.NEWS_TICKER_SERVICE_URL,
        serviceName: 'news-ticker-service',
        requiresAuth: false,
      },
      {
        prefix: '/api/v1/weather',
        target: config.WEATHER_SERVICE_URL,
        serviceName: 'weather-service',
        requiresAuth: false,
      },
      {
        prefix: '/api/v1/demo-control',
        target: config.DEMO_CONTROL_API_URL,
        serviceName: 'demo-control',
        requiresAuth: true,
        // External demo-automation systems may send a stable x-demo-api-key header
        // instead of logging in as the operator -- see the preHandler below.
        allowApiKey: true,
        rewritePrefix: '/api/v1',
      },
      {
        prefix: '/api/v1/messages',
        target: config.NOTIFICATION_SERVICE_URL,
        serviceName: 'notification-service',
        requiresAuth: false,
      },
    ]
  }

  resolve(path) {
    const systemMatch = this.systemRoutes.find(r => path.startsWith(r.prefix));
    if (systemMatch) return systemMatch;

    const semanticMappings = semanticRoutes.map(r => ({
      ...r,
      target: this.config[r.targetKey]
    })).filter(r => r.target);

    const semanticMatch = semanticMappings.find(r => path.startsWith(r.prefix));
    if (semanticMatch) return { ...semanticMatch, requiresAuth: false };



    return null;
  }
}

function buildUpstreamHeaders (originalHeaders, requestId) {
  const headers = Object.assign({}, originalHeaders)
  delete headers['host']
  delete headers['connection']
  delete headers['transfer-encoding']
  delete headers['content-length']
  headers['connection'] = 'close'
  headers['x-request-id'] = requestId
  headers['x-meridian-gateway'] = 'true'
  return headers
}

async function proxyRoutes (fastify, opts) {
  const config = opts.config
  const resolver = new RouteResolver(config)

  fastify.route({
    method: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
    url: '/api/v1/*',
    preHandler: async (request, reply) => {
      const path = request.url.split('?')[0]
      const route = resolver.resolve(path)
      if (!route || !route.requiresAuth) return

      if (route.allowApiKey && config.DEMO_API_KEY && request.headers['x-demo-api-key'] === config.DEMO_API_KEY) {
        return
      }
      return fastify.authenticateOps(request, reply)
    },
    handler: async (request, reply) => {
      const rawUrl = request.url
      const path = rawUrl.split('?')[0]
      const queryString = rawUrl.includes('?') ? rawUrl.slice(rawUrl.indexOf('?')) : ''

      const route = resolver.resolve(path)

      if (!route) {
        return reply.code(404).send({ error: 'No upstream route configured for this path' })
      }

      let upstreamPath
      if (route.rewritePrefix !== undefined) {
        const remainder = path.slice(route.prefix.length)
        upstreamPath = route.rewritePrefix + remainder
      } else {
        upstreamPath = path
      }

      const targetUrl = `${route.target}${upstreamPath}${queryString}`
      const requestId = uuidv4()

      request.log.info(
        { method: request.method, targetUrl, requestId, service: route.serviceName },
        'proxying request'
      )

      const upstreamHeaders = buildUpstreamHeaders(request.headers, requestId)

      const methodsWithBody = ['POST', 'PUT', 'PATCH']
      const sendBody = methodsWithBody.includes(request.method.toUpperCase())
      let upstreamBody
      if (sendBody && request.body != null) {
        if (typeof request.body === 'string' || Buffer.isBuffer(request.body)) {
          upstreamBody = request.body
        } else {
          upstreamBody = JSON.stringify(request.body)
        }
      }

      try {
        const upstreamResponse = await undiciRequest(targetUrl, {
          method: request.method,
          headers: upstreamHeaders,
          body: upstreamBody,
          headersTimeout: 30000,
          bodyTimeout: 30000,
        })

        reply.code(upstreamResponse.statusCode)
        const skipHeaders = new Set(['transfer-encoding', 'connection', 'keep-alive'])
        for (const [key, value] of Object.entries(upstreamResponse.headers)) {
          if (!skipHeaders.has(key.toLowerCase())) {
            reply.header(key, value)
          }
        }

        return reply.send(upstreamResponse.body)
      } catch (err) {
        request.log.error(
          { err: err.message, service: route.serviceName, targetUrl },
          'upstream request failed'
        )
        return reply.code(502).send({
          error: 'Service unavailable',
          service: route.serviceName,
        })
      }
    },
  })
}

module.exports = proxyRoutes

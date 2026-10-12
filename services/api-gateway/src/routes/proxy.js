"use strict"

const { request: undiciRequest } = require('undici')
const { v4: uuidv4 } = require('uuid')

/**
 * RouteResolver handles the mapping of incoming request paths to upstream services.
 * It supports both static system routes and dynamic semantic routes defined in the config.
 */
class RouteResolver {
  constructor(config) {
    this.config = config;
    
    // System routes that are always consistent regardless of industry
    this.systemRoutes = [
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
        prefix: '/api/v1/journey',
        target: config.JOURNEY_SERVICE_URL,
        serviceName: 'journey-service',
        requiresAuth: false,
      },
      {
        prefix: '/api/v1/iot',
        target: config.IOT_SERVICE_URL,
        serviceName: 'iot-service',
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
        rewritePrefix: '/api/v1',
      },
    ]
  }

  /**
   * Resolves a path to a route definition.
   * Priority: System Routes -> Semantic Mappings -> Generic Fallbacks
   */
  resolve(path) {
    // 1. Check static system routes first
    const systemMatch = this.systemRoutes.find(r => path.startsWith(r.prefix));
    if (systemMatch) return systemMatch;

    // 2. Semantic Routing (Dynamic laer)
    // This part is where we move from "hardcoded /api/v1/flights" to 
    // "search config for semantic mapping of the path".
    
    // We handle specific semantic redirects that are common across industries
    const semanticMappings = [
      { 
        prefix: '/api/v1/citizens', 
        target: this.config.IDENTITY_SERVICE_URL, 
        serviceName: 'identity-service', 
        rewritePrefix: '/api/v1/identity' 
      },
      { 
        prefix: '/api/v1/passengers', 
        target: this.config.JOURNEY_SERVICE_URL, 
        serviceName: 'journey-service', 
        rewritePrefix: '/api/v1/journeys' 
      },
      { 
        prefix: '/api/v1/flights', 
        target: this.config.OPS_ENTITY_SERVICE_URL, 
        serviceName: 'ops-entity-service', 
        rewritePrefix: '/api/v1/entities/flight' 
      },
      { 
        prefix: '/api/v1/service-requests', 
        target: this.config.CUSTOMER_ENTITY_SERVICE_URL, 
        serviceName: 'customer-entity-service', 
        rewritePrefix: '/api/v1/entities/service_request' 
      },
    ];

    const semanticMatch = semanticMappings.find(r => path.startsWith(r.prefix));
    if (semanticMatch) return { ...semanticMatch, requiresAuth: false };

    // 3. Generic Entity Engine Fallbacks
    if (path.startsWith('/api/v1/entities/incident')) {
        return { prefix: '/api/v1/entities/incident', target: this.config.OPS_ENTITY_SERVICE_URL, serviceName: 'ops-entity-service', requiresAuth: false };
    }
    if (path.startsWith('/api/v1/entities/work_order')) {
        return { prefix: '/api/v1/entities/work_order', target: this.config.OPS_ENTITY_SERVICE_URL, serviceName: 'ops-entity-service', requiresAuth: false };
    }
    if (path.startsWith('/api/v1/entities/journey')) {
        return { prefix: '/api/v1/entities/journey', target: this.config.JOURNEY_SERVICE_URL, serviceName: 'journey-service', rewritePrefix: '/api/v1/journeys', requiresAuth: false };
    }
    if (path.startsWith('/api/v1/entities')) {
        return { prefix: '/api/v1/entities', target: this.config.CUSTOMER_ENTITY_SERVICE_URL, serviceName: 'customer-entity-service', requiresAuth: false };
    }

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
      if (route && route.requiresAuth) {
        return fastify.authenticateOps(request, reply)
      }
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

'use strict'

const { request: undiciRequest } = require('undici')
const { v4: uuidv4 } = require('uuid')

// Route table: maps URL prefix → { targetBase, serviceName, stripPrefix }
// stripPrefix is what gets removed before forwarding
function buildRouteTable (config) {
  return [
    {
      prefix: '/api/v1/citizens',
      target: config.CITIZEN_SERVICE_URL,
      serviceName: 'citizen-service',
      requiresAuth: false,
    },
    {
      prefix: '/api/v1/service-requests',
      target: config.CITIZEN_SERVICE_URL,
      serviceName: 'citizen-service',
      requiresAuth: false,
    },
    {
      prefix: '/api/v1/dispatch',
      target: config.SERVICE_DISPATCH_URL,
      serviceName: 'service-dispatch',
      requiresAuth: false,
    },
    {
      prefix: '/api/v1/city',
      target: config.CITY_OPERATIONS_URL,
      serviceName: 'city-operations',
      requiresAuth: false,
    },
    {
      prefix: '/api/v1/assets',
      target: config.CITY_OPERATIONS_URL,
      serviceName: 'city-operations',
      requiresAuth: false,
    },
    {
      prefix: '/api/v1/incidents',
      target: config.CITY_OPERATIONS_URL,
      serviceName: 'city-operations',
      requiresAuth: false,
    },
    {
      prefix: '/api/v1/work-orders',
      target: config.CITY_OPERATIONS_URL,
      serviceName: 'city-operations',
      requiresAuth: false,
    },
    {
      prefix: '/api/v1/analytics',
      target: config.ANALYTICS_SERVICE_URL,
      serviceName: 'analytics-service',
      requiresAuth: false,
    },
    {
      prefix: '/api/v1/kpis',
      target: config.ANALYTICS_SERVICE_URL,
      serviceName: 'analytics-service',
      requiresAuth: false,
    },
    {
      prefix: '/api/v1/chat',
      target: config.AI_SERVICE_URL,
      serviceName: 'ai-service',
      requiresAuth: false,
    },
    {
      prefix: '/api/v1/notifications',
      target: config.NOTIFICATION_SERVICE_URL,
      serviceName: 'notification-service',
      requiresAuth: false,
    },
    {
      // demo-control strips /api/v1/demo-control and forwards as /api/v1/<remainder>
      prefix: '/api/v1/demo-control',
      target: config.DEMO_CONTROL_API_URL,
      serviceName: 'demo-control',
      requiresAuth: true,
      rewritePrefix: '/api/v1',
    },
  ]
}

// Build merged headers for the upstream request
function buildUpstreamHeaders (originalHeaders, requestId) {
  const headers = Object.assign({}, originalHeaders)

  // Remove hop-by-hop headers
  delete headers['host']
  delete headers['connection']
  delete headers['transfer-encoding']
  // Drop the original content-length: the body is re-serialized below, so its
  // byte length may differ. Let undici recompute it from the outgoing body.
  delete headers['content-length']

  headers['x-request-id'] = requestId
  headers['x-meridian-gateway'] = 'true'

  return headers
}

async function proxyRoutes (fastify, opts) {
  const config = opts.config
  const routeTable = buildRouteTable(config)

  // Register a wildcard route for all /api/v1/* traffic not handled by auth routes
  fastify.route({
    method: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
    url: '/api/v1/*',
    preHandler: async (request, reply) => {
      const path = request.url.split('?')[0]
      const route = routeTable.find(r => path.startsWith(r.prefix))
      if (route && route.requiresAuth) {
        return fastify.authenticateOps(request, reply)
      }
    },
    handler: async (request, reply) => {
      const rawUrl = request.url
      const path = rawUrl.split('?')[0]
      const queryString = rawUrl.includes('?') ? rawUrl.slice(rawUrl.indexOf('?')) : ''

      // Find matching route
      const route = routeTable.find(r => path.startsWith(r.prefix))

      if (!route) {
        return reply.code(404).send({ error: 'No upstream route configured for this path' })
      }

      // Build upstream path
      let upstreamPath
      if (route.rewritePrefix !== undefined) {
        // Strip the route prefix and prepend the rewritePrefix
        const remainder = path.slice(route.prefix.length) // e.g. "" or "/some/thing"
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

      // Determine whether to send a body
      const methodsWithBody = ['POST', 'PUT', 'PATCH']
      const sendBody = methodsWithBody.includes(request.method.toUpperCase())

      // Fastify has already parsed JSON bodies into a plain object; undici only
      // accepts string/Buffer/stream, so re-serialize objects to JSON. Passing
      // the raw object straight through makes undici throw, which surfaced as a
      // 502 on every proxied POST (chat, create service request, etc.).
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

        // Forward relevant response headers
        const skipHeaders = new Set(['transfer-encoding', 'connection', 'keep-alive'])
        for (const [key, value] of Object.entries(upstreamResponse.headers)) {
          if (!skipHeaders.has(key.toLowerCase())) {
            reply.header(key, value)
          }
        }

        // Stream body back
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

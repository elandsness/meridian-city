'use strict'

const fastify = require('fastify')
const cors = require('@fastify/cors')
const sensible = require('@fastify/sensible')
const authPlugin = require('./plugins/auth')
const healthRoutes = require('./routes/health')
const authRoutes = require('./routes/auth')
const proxyRoutes = require('./routes/proxy')

const config = {
  PORT: process.env.PORT || 3000,
  JWT_SECRET: process.env.JWT_SECRET || 'meridian-demo-secret-change-me',
  AUTH_USERNAME: process.env.AUTH_USERNAME || 'demo',
  AUTH_PASSWORD: process.env.AUTH_PASSWORD || 'dynatrace',
  CITIZEN_SERVICE_URL: process.env.CITIZEN_SERVICE_URL || 'http://localhost:8081',
  SERVICE_DISPATCH_URL: process.env.SERVICE_DISPATCH_URL || 'http://localhost:8082',
  CITY_OPERATIONS_URL: process.env.CITY_OPERATIONS_URL || 'http://localhost:8083',
  ANALYTICS_SERVICE_URL: process.env.ANALYTICS_SERVICE_URL || 'http://localhost:8084',
  AI_SERVICE_URL: process.env.AI_SERVICE_URL || 'http://localhost:8085',
  NOTIFICATION_SERVICE_URL: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:8087',
  COMMERCE_SERVICE_URL: process.env.COMMERCE_SERVICE_URL || 'http://localhost:8090',
  BILLING_SERVICE_URL: process.env.BILLING_SERVICE_URL || 'http://localhost:8091',
  TELEMETRY_PROCESSOR_URL: process.env.TELEMETRY_PROCESSOR_URL || 'http://localhost:8086',
  DEMO_CONTROL_API_URL: process.env.DEMO_CONTROL_API_URL || 'http://localhost:3001',
}

async function build () {
  const app = fastify({
    logger: {
      level: 'info',
    },
  })

  // Plugins
  await app.register(cors, {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: '*',
  })

  await app.register(sensible)

  await app.register(authPlugin, { config })

  // Routes
  await app.register(healthRoutes, { config })
  await app.register(authRoutes, { config })
  await app.register(proxyRoutes, { config })

  // Log each incoming request with method and url
  app.addHook('onRequest', async (request) => {
    request.log.info({ method: request.method, url: request.url }, 'incoming request')
  })

  return app
}

async function start () {
  let app
  try {
    app = await build()
    await app.listen({ port: Number(config.PORT), host: '0.0.0.0' })
    app.log.info(`Meridian API Gateway running on port ${config.PORT}`)
  } catch (err) {
    if (app) {
      app.log.error(err)
    } else {
      console.error(err)
    }
    process.exit(1)
  }
}

start()

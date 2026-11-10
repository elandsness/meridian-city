'use strict'

const fs = require('fs')
const fastify = require('fastify')
const cors = require('@fastify/cors')
const sensible = require('@fastify/sensible')
const authPlugin = require('./plugins/auth')
const healthRoutes = require('./routes/health')
const authRoutes = require('./routes/auth')
const proxyRoutes = require('./routes/proxy')

// Load Industry Config for Semantic Routing
let industryConfig = {}
const configPath = process.env.INDUSTRY_CONFIG_PATH
if (configPath && fs.existsSync(configPath)) {
  try {
    industryConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'))
  } catch (e) {
    console.error(`Failed to parse industry config at ${configPath}: ${e.message}`)
  }
}

const config = {
  PORT: process.env.PORT || 3000,
  JWT_SECRET: process.env.JWT_SECRET || 'meridian-demo-secret-change-me',
  AUTH_USERNAME: process.env.AUTH_USERNAME || 'demo',
  AUTH_PASSWORD: process.env.AUTH_PASSWORD || 'dynatrace',
  DEMO_API_KEY: process.env.DEMO_API_KEY || '',
  CITIZEN_SERVICE_URL: process.env.CITIZEN_SERVICE_URL || 'http://localhost:8081',
  SERVICE_DISPATCH_URL: process.env.SERVICE_DISPATCH_URL || 'http://localhost:8082',
  CITY_OPERATIONS_URL: process.env.CITY_OPERATIONS_URL || 'http://localhost:8083',
  FLIGHT_OPS_URL: process.env.FLIGHT_OPS_URL || 'http://localhost:8092',
  PASSENGER_SERVICE_URL: process.env.PASSENGER_SERVICE_URL || 'http://localhost:8093',
  ANALYTICS_SERVICE_URL: process.env.ANALYTICS_SERVICE_URL || 'http://localhost:8084',
  AI_SERVICE_URL: process.env.AI_SERVICE_URL || 'http://localhost:8085',
  NOTIFICATION_SERVICE_URL: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:8087',
  COMMERCE_SERVICE_URL: process.env.COMMERCE_SERVICE_URL || 'http://localhost:8090',
  BILLING_SERVICE_URL: process.env.BILLING_SERVICE_URL || 'http://localhost:8091',
  DEMO_CONTROL_API_URL: process.env.DEMO_CONTROL_API_URL || 'http://localhost:3001',
  IDENTITY_SERVICE_URL: process.env.IDENTITY_SERVICE_URL || 'http://localhost:8081',
  WORKFLOW_SERVICE_URL: process.env.WORKFLOW_SERVICE_URL || 'http://localhost:8083',
  TRANSACTION_SERVICE_URL: process.env.TRANSACTION_SERVICE_URL || 'http://localhost:8090',
  JOURNEY_SERVICE_URL: process.env.JOURNEY_SERVICE_URL || 'http://localhost:8093',
  IOT_SIMULATOR_URL: process.env.IOT_SIMULATOR_URL || 'http://localhost:8088',
  NEWS_TICKER_SERVICE_URL: process.env.NEWS_TICKER_SERVICE_URL || 'http://localhost:8095',
  WEATHER_SERVICE_URL: process.env.WEATHER_SERVICE_URL || 'http://localhost:8096',
  ENTITY_ENGINE_URL: process.env.ENTITY_ENGINE_URL || 'http://localhost:8094',
  CUSTOMER_ENTITY_SERVICE_URL: process.env.CUSTOMER_ENTITY_SERVICE_URL || 'http://localhost:8094',
  OPS_ENTITY_SERVICE_URL: process.env.OPS_ENTITY_SERVICE_URL || 'http://localhost:8094',
  industryConfig: industryConfig
}

async function build () {
  const app = fastify({
    logger: {
      level: 'info',
    },
  })

  app.addContentTypeParser('*', { parseAs: 'buffer' }, (req, body, done) => {
    done(null, body)
  })

  await app.register(cors, {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: '*',
  })

  await app.register(sensible)

  await app.register(authPlugin, { config })

  await app.register(healthRoutes, { config })
  await app.register(authRoutes, { config })
  await app.register(proxyRoutes, { config })

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

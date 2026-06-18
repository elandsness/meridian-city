'use strict'

/**
 * Meridian City Demo Control API
 *
 * Fastify HTTP server exposing the demo orchestration REST API.
 * Consumed by the ops-dashboard demo control panel.
 *
 * Route groups:
 *   GET  /health                         — liveness
 *   GET  /api/v1/status                  — full system state snapshot
 *   GET/POST /api/v1/fault/*             — fault injection per service
 *   GET/POST/DELETE /api/v1/fleet/*      — IoT fleet management
 *   GET/POST /api/v1/traffic/*           — traffic bot control
 *   GET/POST/DELETE /api/v1/scenarios/*  — demo scenario orchestration
 */

const fastify = require('fastify')
const cors = require('@fastify/cors')
const sensible = require('@fastify/sensible')
const config = require('./config')

const healthRoutes    = require('./routes/health')
const faultRoutes     = require('./routes/fault')
const fleetRoutes     = require('./routes/fleet')
const trafficRoutes   = require('./routes/traffic')
const scenarioRoutes  = require('./routes/scenarios')
const transitRoutes   = require('./routes/transit')
const { startTransitSimulation } = require('./transit')

async function build () {
  const app = fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
    },
  })

  await app.register(cors, {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: '*',
  })

  await app.register(sensible)

  // Routes
  await app.register(healthRoutes)
  await app.register(faultRoutes)
  await app.register(fleetRoutes)
  await app.register(trafficRoutes)
  await app.register(scenarioRoutes)
  await app.register(transitRoutes)

  // Start the in-memory transit simulation (vehicles + statuses for the public map).
  startTransitSimulation()

  // Log each request
  app.addHook('onRequest', async (request) => {
    request.log.info({ method: request.method, url: request.url }, 'incoming request')
  })

  return app
}

async function start () {
  let app
  try {
    app = await build()
    await app.listen({ port: config.PORT, host: '0.0.0.0' })
    app.log.info(`Demo Control API running on port ${config.PORT}`)
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

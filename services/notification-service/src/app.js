'use strict'

/**
 * Meridian City Notification Service
 *
 * Express HTTP server with:
 *   - GET  /health
 *   - GET  /api/v1/notifications          (recent notifications)
 *   - GET  /api/v1/notifications/count
 *   - DELETE /api/v1/notifications        (demo reset)
 *   - GET  /api/v1/notifications/stream   (SSE real-time push)
 *
 * Kafka consumer (kafkajs) subscribes to:
 *   - iot.anomalies
 *   - requests.events
 *
 * Startup is non-fatal if Kafka is unreachable — HTTP endpoints work
 * immediately; the Kafka consumer logs the error and gives up retrying.
 */

const express = require('express')
const { start: startKafka, stop: stopKafka } = require('./kafka')
const { init: initDb } = require('./db')
const healthRoutes = require('./routes/health')
const notificationRoutes = require('./routes/notifications')
const messageRoutes = require('./routes/messages')

const PORT = parseInt(process.env.PORT || '8087', 10)

const app = express()
app.use(express.json())

// Structured JSON logging middleware
app.use((req, _res, next) => {
  console.log(JSON.stringify({
    level: 'info',
    msg: 'incoming request',
    method: req.method,
    url: req.url,
  }))
  next()
})

// Routes
app.use('/health', healthRoutes)
app.use('/api/v1/notifications', notificationRoutes)
app.use('/api/v1/messages', messageRoutes)

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'not found' })
})

// Error handler
app.use((err, _req, res, _next) => {
  console.error(JSON.stringify({ level: 'error', msg: err.message, stack: err.stack }))
  res.status(500).json({ error: 'internal server error' })
})

async function main () {
  // Initialise the inbox DB schema — non-fatal, inbox calls no-op until ready
  initDb().catch(err => {
    console.error(JSON.stringify({
      level: 'error',
      msg: 'messages DB init failed (inbox disabled)',
      error: err.message,
    }))
  })

  // Start Kafka consumer in background — failure does not block HTTP startup
  startKafka().catch(err => {
    console.error(JSON.stringify({
      level: 'error',
      msg: 'Kafka consumer failed to start',
      error: err.message,
    }))
  })

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(JSON.stringify({
      level: 'info',
      msg: `notification-service running on port ${PORT}`,
      port: PORT,
    }))
  })

  // Graceful shutdown
  const shutdown = async (signal) => {
    console.log(JSON.stringify({ level: 'info', msg: `${signal} received — shutting down` }))
    await stopKafka()
    server.close(() => {
      console.log(JSON.stringify({ level: 'info', msg: 'shutdown complete' }))
      process.exit(0)
    })
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}

main()

'use strict'

/**
 * Notification routes for notification-service.
 *
 * GET  /                  — list recent notifications (?limit=50)
 * GET  /count             — total notifications in the buffer
 * DELETE /                — clear all notifications (demo reset)
 * GET  /stream            — Server-Sent Events stream for real-time push
 */

const { Router } = require('express')
const { getRecent, getCount, clear, addClient } = require('../notifications')

const router = Router()

// ---- REST endpoints -------------------------------------------------------

router.get('/', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '50', 10), 200)
  res.json({
    notifications: getRecent(limit),
    total: getCount(),
  })
})

router.get('/count', (req, res) => {
  res.json({ count: getCount() })
})

router.delete('/', (req, res) => {
  clear()
  res.status(204).end()
})

// ---- SSE stream ------------------------------------------------------------

router.get('/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no') // disable nginx buffering
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.flushHeaders()

  // Send a connection confirmation event
  res.write(`event: connected\ndata: ${JSON.stringify({ ts: new Date().toISOString() })}\n\n`)

  // Heartbeat comment every 25 s — keeps the connection alive through proxies
  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n')
    } catch {
      clearInterval(heartbeat)
    }
  }, 25_000)

  const cleanup = addClient(res)

  req.on('close', () => {
    clearInterval(heartbeat)
    cleanup()
  })
})

module.exports = router

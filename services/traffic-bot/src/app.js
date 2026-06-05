'use strict'

/**
 * Meridian Traffic Bot
 *
 * HTTP control server (port 8089) + traffic runner.
 *
 * Endpoints (called by demo-control-api):
 *   GET  /health           — liveness probe
 *   GET  /api/v1/status    — full status JSON
 *   POST /api/v1/start     — start the journey loop
 *   POST /api/v1/stop      — stop the journey loop
 *   POST /api/v1/burst     — 10× load burst  { duration_minutes? }
 *   POST /api/v1/scenario  — run one journey  { scenario }
 */

const express = require('express')
const config  = require('./config')
const runner  = require('./runner')

const app = express()
app.use(express.json())

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', ...runner.getStatus() })
})

app.get('/api/v1/status', (_req, res) => {
  res.json(runner.getStatus())
})

app.post('/api/v1/start', (_req, res) => {
  runner.start()
  res.json({ ok: true, message: 'Traffic bot started', ...runner.getStatus() })
})

app.post('/api/v1/stop', (_req, res) => {
  runner.stop()
  res.json({ ok: true, message: 'Traffic bot stopped', ...runner.getStatus() })
})

app.post('/api/v1/burst', (req, res) => {
  const durationMinutes = parseInt(req.body?.duration_minutes ?? '2', 10)
  if (durationMinutes < 1 || durationMinutes > 60) {
    return res.status(400).json({ error: 'duration_minutes must be between 1 and 60' })
  }
  runner.burst(durationMinutes)
  res.json({ ok: true, message: `Burst started for ${durationMinutes}m`, ...runner.getStatus() })
})

app.post('/api/v1/scenario', async (req, res) => {
  const { scenario } = req.body || {}
  if (!scenario) {
    return res.status(400).json({ error: 'scenario is required' })
  }
  try {
    const result = await runner.runScenario(scenario)
    res.json({ ok: true, ...result })
  } catch (err) {
    res.status(422).json({ ok: false, error: err.message })
  }
})

// 404 catch-all
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' })
})

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

app.listen(config.PORT, '0.0.0.0', () => {
  console.log(`[traffic-bot] Listening on :${config.PORT}`)
  console.log(`[traffic-bot] Target: ${config.TARGET_URL}`)
  console.log(`[traffic-bot] Rate: ${config.REQUESTS_PER_MINUTE} RPM`)
  console.log(`[traffic-bot] Scenarios: ${JSON.stringify(config.SCENARIOS)}`)

  // Auto-start — the demo control panel can stop/restart at will
  runner.start()
})

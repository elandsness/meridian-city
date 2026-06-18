'use strict'

/**
 * Inject Anomaly Journey
 *
 * Keeps the IoT incident pipeline alive without an operator clicking around:
 * periodically injects a real (simulator-supported) anomaly on a random device, and
 * sometimes clears all active anomalies so devices recover. Each injected anomaly
 * breaches a telemetry-processor threshold → iot.anomalies → city-operations incident
 * → work-order lifecycle, so the Home incidents widget and the iot-incident funnel
 * stay populated.
 *
 * The inject/clear endpoints live behind the operator-authed /api/v1/demo-control
 * prefix, so this journey logs in as the demo operator (cached token) — unlike the
 * citizen-facing journeys, which are unauthenticated.
 *
 * Steps:
 *   1. Operator login              (POST /api/v1/auth/login)        [cached]
 *   2. List devices                (GET  /api/v1/devices)
 *   3a. Clear all anomalies (~30%) (DELETE /api/v1/demo-control/fleet/anomaly)
 *   3b. or inject one (~70%)       (POST   /api/v1/demo-control/fleet/anomaly)
 */

const axios = require('axios')
const config = require('../config')

const client = axios.create({
  baseURL: config.TARGET_URL,
  timeout: 15_000,
  validateStatus: (s) => s < 500,
})

// Simulator-supported anomaly types per device category (matches the iot-simulator
// vocabulary + demo-control-api's resolveAnomalyType).
const ANOMALY_TYPES = {
  vehicle: ['engine_overtemp', 'high_speed'],
  building: ['hvac_overtemp'],
  machine: ['high_vibration', 'high_error_rate'],
}

const CLEAR_CHANCE = 0.3
const TOKEN_TTL_MS = 10 * 60_000

let _token = null
let _tokenAt = 0

async function operatorToken() {
  if (_token && Date.now() - _tokenAt < TOKEN_TTL_MS) return _token
  const res = await client.post('/api/v1/auth/login', { username: 'demo', password: 'dynatrace' })
  _token = res.data?.token || null
  _tokenAt = Date.now()
  return _token
}

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]

async function run() {
  const token = await operatorToken()
  if (!token) throw new Error('no operator token for anomaly injection')
  const auth = { headers: { Authorization: `Bearer ${token}` } }

  const devRes = await client.get('/api/v1/devices')
  const devices = Array.isArray(devRes.data?.items)
    ? devRes.data.items
    : Array.isArray(devRes.data) ? devRes.data : []
  if (devices.length === 0) return

  // Sometimes clear everything so devices recover and incidents don't pile up forever.
  if (Math.random() < CLEAR_CHANCE) {
    await client.delete('/api/v1/demo-control/fleet/anomaly', auth)
    return
  }

  // Otherwise inject a supported anomaly on a healthy device.
  const healthy = devices.filter((d) => (d.status || 'ok') === 'ok')
  const device = pick(healthy.length ? healthy : devices)
  const types = ANOMALY_TYPES[device.category]
  if (!types) return // unknown category — skip rather than send a bad type
  await client.post(
    '/api/v1/demo-control/fleet/anomaly',
    { category: device.category, device_id: device.device_id, anomaly_type: pick(types) },
    auth
  )
}

module.exports = { run }

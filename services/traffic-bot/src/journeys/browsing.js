'use strict'

/**
 * Browsing Journey
 *
 * Simulates a citizen browsing the city portal — checking incidents,
 * city assets, and building info — without submitting anything.
 * Generates steady background read traffic across city-operations.
 *
 * Steps (random 1–3 of these, in order):
 *   1. List active incidents    (GET /api/v1/incidents)
 *   2. List city assets         (GET /api/v1/assets)
 *   3. List buildings           (GET /api/v1/city/buildings)
 */

const axios = require('axios')
const config = require('../config')

const client = axios.create({
  baseURL: config.TARGET_URL,
  timeout: 10_000,
  validateStatus: (s) => s < 500,
})

// Weighted step count: 60% browse all 3, 25% browse 2, 15% browse 1
function stepCount() {
  const r = Math.random()
  if (r < 0.60) return 3
  if (r < 0.85) return 2
  return 1
}

async function run() {
  const steps = [
    () => client.get('/api/v1/incidents'),
    () => client.get('/api/v1/assets'),
    () => client.get('/api/v1/city/buildings'),
  ]

  const count = stepCount()
  for (let i = 0; i < count; i++) {
    await steps[i]()
    // Small pause to simulate page dwell time
    if (i < count - 1) {
      await new Promise(r => setTimeout(r, 150 + Math.random() * 500))
    }
  }
}

module.exports = { run }

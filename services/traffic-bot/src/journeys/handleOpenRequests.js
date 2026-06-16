'use strict'

/**
 * Handle Open Requests Journey ("ops side")
 *
 * Picks up real, citizen-submitted service requests and advances them through
 * the lifecycle so the Business Event funnel (Flow A) and the inbox
 * (request_resolved) populate without a human operator. This is what makes the
 * demo self-sustaining once citizens (or the citizenRequest journey) file requests.
 *
 * Steps:
 *   1. List recent requests across all citizens (GET /api/v1/service-requests)
 *   2. For a few still-open ones, advance status one step toward resolved
 *      (PATCH /api/v1/service-requests/:id/status)
 */

const axios = require('axios')
const config = require('../config')

const client = axios.create({
  baseURL: config.TARGET_URL,
  timeout: 15_000,
  validateStatus: (s) => s < 500,
})

const PRE_PROGRESS = new Set(['submitted', 'dispatched', 'assigned', 'acknowledged'])
const CLOSED = new Set(['resolved', 'cancelled'])

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function run() {
  const res = await client.get('/api/v1/service-requests?limit=50')
  const list = Array.isArray(res.data) ? res.data : res.data?.items || res.data?.requests || []
  const open = list.filter((r) => !CLOSED.has((r.status || '').toLowerCase()))

  for (const r of open.slice(0, 3)) {
    const status = (r.status || '').toLowerCase()
    const next = PRE_PROGRESS.has(status) ? 'in_progress' : status === 'in_progress' ? 'resolved' : null
    if (next) {
      await client.patch(`/api/v1/service-requests/${r.id}/status`, { status: next })
      await sleep(500)
    }
  }
}

module.exports = { run }

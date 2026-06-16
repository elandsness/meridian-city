'use strict'

/**
 * Pay Tax Journey
 *
 * Simulates a citizen paying an outstanding tax bill. Drives the Tax Payment
 * funnel (Flow E): tax.bill_issued → tax.payment_completed.
 *
 * Bills are generated asynchronously (billing-service consumes the
 * citizen.registered event), so we register then poll briefly for an outstanding
 * bill before paying.
 *
 * Steps:
 *   1. Register a citizen     (POST /api/v1/citizens)
 *   2. Poll outstanding bills (GET  /api/v1/billing/bills?citizen_id=&status=outstanding)
 *   3. Pay one bill           (POST /api/v1/billing/bills/:id/pay)
 */

const axios = require('axios')
const config = require('../config')
const data = require('../data')

const client = axios.create({
  baseURL: config.TARGET_URL,
  timeout: 15_000,
  validateStatus: (s) => s < 500,
})

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function run() {
  const reg = await client.post('/api/v1/citizens', data.generateCitizen())
  const citizenId = reg.data?.id
  if (!citizenId) throw new Error('no citizenId in citizen registration response')

  let bills = []
  for (let attempt = 0; attempt < 6; attempt++) {
    await sleep(1000)
    const res = await client.get(`/api/v1/billing/bills?citizen_id=${citizenId}&status=outstanding`)
    bills = Array.isArray(res.data) ? res.data : res.data?.items || []
    if (bills.length > 0) break
  }
  if (bills.length === 0) return // generation still catching up — nothing to pay this run

  await client.post(`/api/v1/billing/bills/${bills[0].id}/pay`)
}

module.exports = { run }

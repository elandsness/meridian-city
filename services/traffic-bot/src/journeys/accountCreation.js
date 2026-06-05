'use strict'

/**
 * Account Creation Journey
 *
 * Simulates a new citizen registering with the city portal.
 * Drives Business Events flow:
 *   account.registration_started → account.details_submitted → account.activated
 *
 * Steps:
 *   1. Create citizen account  (POST /api/v1/citizens)
 *   2. View citizen profile    (GET  /api/v1/citizens/:id)
 */

const axios = require('axios')
const config = require('../config')
const data   = require('../data')

const client = axios.create({
  baseURL: config.TARGET_URL,
  timeout: 15_000,
  validateStatus: (s) => s < 500,
})

async function run() {
  // Step 1: Register
  const citizenBody = data.generateCitizen()
  const res = await client.post('/api/v1/citizens', citizenBody)
  if (res.status !== 201 && res.status !== 200) {
    throw new Error(`citizen registration returned ${res.status}`)
  }
  const citizenId = res.data?.id
  if (!citizenId) throw new Error('no citizenId in citizen registration response')

  // Step 2: View profile (simulates the post-registration confirmation page)
  await client.get(`/api/v1/citizens/${citizenId}`)
}

module.exports = { run }

'use strict'

/**
 * Citizen Request Journey
 *
 * Simulates a citizen submitting a service request end-to-end.
 * Drives Business Events flow:
 *   service_request.submitted → service_request.validated →
 *   service_request.dispatched → service_request.assigned → ...
 *
 * Steps:
 *   1. Create a new citizen account  (POST /api/v1/citizens)
 *   2. Submit a service request      (POST /api/v1/service-requests)
 *   3. View the created request      (GET  /api/v1/service-requests/:id)
 *   4. List citizen's requests       (GET  /api/v1/service-requests?citizenId=:id)
 */

const axios = require('axios')
const config = require('../config')
const data   = require('../data')

const client = axios.create({
  baseURL: config.TARGET_URL,
  timeout: 15_000,
  validateStatus: (s) => s < 500, // don't throw on 4xx — log and continue
})

async function run() {
  // Step 1: Register citizen
  const citizenBody = data.generateCitizen()
  const regRes = await client.post('/api/v1/citizens', citizenBody)
  if (regRes.status !== 201 && regRes.status !== 200) {
    throw new Error(`citizen registration returned ${regRes.status}`)
  }
  const citizenId = regRes.data?.id
  if (!citizenId) throw new Error('no citizenId in citizen registration response')

  // Step 2: Submit service request
  const srBody = data.generateServiceRequest(citizenId)
  const srRes = await client.post('/api/v1/service-requests', srBody)
  if (srRes.status !== 201 && srRes.status !== 200) {
    throw new Error(`service request submission returned ${srRes.status}`)
  }
  const requestId = srRes.data?.id
  if (!requestId) throw new Error('no requestId in service request response')

  // Step 3: View the request
  await client.get(`/api/v1/service-requests/${requestId}`)

  // Step 4: List citizen's requests
  await client.get(`/api/v1/service-requests?citizenId=${citizenId}`)
}

module.exports = { run }

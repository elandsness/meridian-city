'use strict'

/**
 * Chatbot Journey
 *
 * Simulates a citizen using the "Ask the City Assistant" AI chatbot.
 * Each run sends one message — creates a `meridian.chat` LLM span visible in
 * Dynatrace AI Observability.
 *
 * Enabled by default at the lowest journey weight (see journeys/index.js) so a
 * steady `meridian.chat` baseline exists for the `llm-latency` demo scenario to
 * deviate from. Set SCENARIO_CHATBOT=false to disable if real LLM cost is a concern.
 *
 * Step:
 *   1. Send chat message  (POST /api/v1/chat)
 */

const axios = require('axios')
const { randomUUID } = require('crypto')
const config = require('../config')
const data   = require('../data')

const client = axios.create({
  baseURL: config.TARGET_URL,
  timeout: 45_000, // LLM calls can be slow
  validateStatus: (s) => s < 500,
})

async function run() {
  const sessionId = randomUUID()
  const message   = data.randomChatQuestion()

  const res = await client.post('/api/v1/chat', {
    session_id: sessionId,
    message,
  })

  if (res.status !== 200) {
    throw new Error(`chat returned ${res.status}`)
  }
}

module.exports = { run }

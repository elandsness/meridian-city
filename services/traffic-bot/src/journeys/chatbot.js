'use strict'

/**
 * Chatbot Journey
 *
 * Simulates a citizen using the "Ask the City Assistant" AI chatbot.
 * Each run sends one message — creates an LLM span visible in
 * Dynatrace AI Observability.
 *
 * Disabled by default (SCENARIO_CHATBOT=true to enable) to avoid
 * unexpected LLM API costs during steady-state demos.
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

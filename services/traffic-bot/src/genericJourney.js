'use strict'

const axios = require('axios')
const config = require('./config')

const client = axios.create({
  baseURL: config.TARGET_URL,
  timeout: 15_000,
  validateStatus: (s) => s < 500,
})

/**
 * Executes a journey defined as a sequence of steps.
 * 
 * Step Shape: { method, path, body, query }
 */
async function runGenericJourney(definition) {
  const context = {}
  
  for (const stepDef of definition.steps) {
    const step = typeof stepDef === 'function' ? stepDef(context) : stepDef
    const path = typeof step.path === 'function' ? step.path(context) : step.path
    const body = typeof step.body === 'function' ? step.body(context) : step.body
    const query = typeof step.query === 'function' ? step.query(context) : step.query

    const response = await client({
      method: step.method || 'get',
      url: path,
      data: body,
      params: query
    })

    if (response.data) {
      Object.assign(context, response.data)
    }
  }
}

module.exports = { runGenericJourney }

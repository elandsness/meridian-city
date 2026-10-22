'use strict'

const axios = require('axios')
const config = require('./config')
const data = require('./data')

const client = axios.create({
  baseURL: config.TARGET_URL,
  timeout: 15_000,
  validateStatus: (s) => s < 500,
})

async function runGenericJourney(def) {
  const { entityType, config: entityDef } = def
  
  const body = data.generateEntityBody(entityType, entityDef)
  const spawnRes = await client.post(`/api/v1/entities/${entityType}`, body)
  if (!spawnRes.data || !spawnRes.data.id) {
    throw new Error(`Failed to spawn entity ${entityType}: ${JSON.stringify(spawnRes.data)}`)
  }
  const id = spawnRes.data.id
  let currentState = entityDef.initial

  while (true) {
    const stateDef = entityDef.states?.[currentState]
    if (!stateDef) break
    if (stateDef.terminal) break

    const transition = (entityDef.transitions || []).find(t => t.from === currentState)
    if (!transition) break

    const nextState = transition.to
    await client.post(`/api/v1/entities/${entityType}/${id}/actions/${nextState}`)
    currentState = nextState
  }
}

module.exports = { runGenericJourney }

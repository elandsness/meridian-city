'use strict'

const config = require('./config')
const data = require('./data')

function resolveJourneys() {
  const entities = config.INDUSTRY_CONFIG.entities || {}
  const activeFlows = config.INDUSTRY_CONFIG.analytics?.flows || []
  const definitions = {}

  activeFlows.forEach(flow => {
    const flowId = typeof flow === 'string' ? flow : flow.id
    if (!flowId) return

    const entityType = Object.keys(entities).find(type => 
      type === flowId || flowId.startsWith(type)
    )

    if (entityType && entities[entityType]) {
      const entityDef = entities[entityType]
      definitions[flowId] = {
        entityType: entityType,
        name: entityDef.displayName || entityType,
        weight: 25,
        config: entityDef 
      }
    } else {
      console.warn(`[journeyDefinitions] No entity found to drive flow: ${flowId}`)
    }
  })

  return definitions
}

const JOURNEY_DEFINITIONS = resolveJourneys()

module.exports = { JOURNEY_DEFINITIONS }

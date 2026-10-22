'use strict'

const config = require('./config')
const data = require('./data')

/**
 * Purely config-driven journey resolution.
 * Instead of hardcoded blueprints, we derive the lifecycle of an entity
 * from its definition in the industry config.
 */
function resolveJourneys() {
  const dynatrace = config.INDUSTRY_CONFIG.dynatrace || {}
  const flows = dynatrace.flows || []
  const entities = dynatrace.entities || {}
  const definitions = {}

  flows.forEach(flow => {
    const flowId = typeof flow === 'string' ? flow : flow.id
    if (!flowId) return

    // 1. Derive Entity Type from the correlation ID (e.g., 'passenger.id' -> 'passenger')
    const correlationId = typeof flow === 'string' ? null : flow.correlationID
    if (!correlationId) return
    const entityType = correlationId.split('.')[0]

    const entityDef = entities[entityType]
    if (!entityDef) {
      console.warn(`[journeyDefinitions] No entity definition found for type: ${entityType} (flow: ${flowId})`)
      return
    }

    // 2. Build the step sequence from the entity's defined sequence
    // Format: [initial, state1, state2, ...]
    const sequence = entityDef.sequence || []
    if (sequence.length === 0) return

    const steps = []

    // Step A: Create the entity. This puts it in the 'initial' state.
    steps.push({
      method: 'post',
      path: `/api/v1/entities/${entityType}`,
      body: () => data.generateEntityBody(entityDef)
    })

    // Step B: Drive the entity through the remaining sequence of states.
    // We start from index 1 because index 0 is the 'initial' state created above.
    for (let i = 1; i < sequence.length; i++) {
      const nextState = sequence[i]
      steps.push({
        method: 'post',
        path: (ctx) => `/api/v1/entities/${entityType}/${ctx.id}/actions/${nextState}`
      })
    }

    definitions[flowId] = {
      name: entityDef.displayName || entityType,
      weight: 25,
      steps: steps
    }
  })

  return definitions
}

const JOURNEY_DEFINITIONS = resolveJourneys()

module.exports = { JOURNEY_DEFINITIONS }

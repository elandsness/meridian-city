'use strict'

const blueprints = require('./blueprints')
const config = require('./config')

/**
 * Map the a business flow ID (from INDUSTRY_CONFIG) to a Behavioral Blueprint.
 */
const FLOW_TO_BLUEPRINT_MAP = {
  'account-creation': 'registration',
  'service-request':  'serviceRequest',
  'browsing':         'browsing',
  'chatbot':          'chatbot'
}

/**
 * Derive the journey definitions entirely from the industry configuration.
 * A flow is simulated only if it is listed in the industry's analytics flows.
 */
function resolveJourneys() {
  const flows = config.INDUSTRY_CONFIG.analytics?.flows || []
  const definitions = {}

  flows.forEach(flow => {
    const flowId = typeof flow === 'string' ? flow : flow.id;
    if (!flowId) return;

    const blueprintKey = FLOW_TO_BLUEPRINT_MAP[flowId]
    const blueprint = blueprints[blueprintKey]

    if (blueprint) {
      definitions[flowId] = {
        name: blueprint.name,
        weight: 25, // Default balanced weight
        steps: blueprint.steps
      }
    } else {
      console.warn(`[journeyDefinitions] No blueprint found for flow: ${flowId}`)
    }
  })

  return definitions
}

const JOURNEY_DEFINITIONS = resolveJourneys()

module.exports = { JOURNEY_DEFINITIONS }

'use strict'

/**
 * Cross-service health aggregator for the ops Command Center: "what business
 * flow data is flowing, what traffic we have going, what failure scenarios
 * are active" -- assembled live from whatever this instance's services
 * report (no local caching, no Dynatrace dependency). proxy.* calls never
 * throw (they resolve to {ok:false, ...}), so one unreachable upstream
 * degrades its own section instead of failing the whole response.
 *
 * Entity-type/record reads only hit CUSTOMER_ENTITY_SERVICE_URL: entity-engine's
 * EntityController/EntityController read path is unfiltered by ownership (see
 * EntityConfigLoader.require(), which reads allDefinitions, not the
 * ownership-filtered set), so customer-entity-service and ops-entity-service
 * return identical entity-type/record data today -- querying both would just
 * double every count. Fault-gate state is different: each is a separate pod
 * with its own in-memory FaultGateRegistry, so those two ARE queried separately.
 */

const config = require('./config')
const proxy = require('./proxy')
const { getActiveScenario, getFaults } = require('./state')

/** One flow per configured entity type, with a volume + state-bucket breakdown. */
async function entityFlows () {
  const typesResult = await proxy.get(`${config.CUSTOMER_ENTITY_SERVICE_URL}/api/v1/entity-types`)
  if (!typesResult.ok) return []
  const types = Array.isArray(typesResult.data) ? typesResult.data : []

  const perType = await Promise.all(types.map(async (type) => {
    const listResult = await proxy.get(`${config.CUSTOMER_ENTITY_SERVICE_URL}/api/v1/entities/${encodeURIComponent(type.entityType)}`)
    const records = listResult.ok && Array.isArray(listResult.data) ? listResult.data : []
    const byState = {}
    let errorCount = 0
    for (const record of records) {
      const state = record.state || 'unknown'
      byState[state] = (byState[state] || 0) + 1
      if (type.states?.[state]?.isError) errorCount += 1
    }
    return {
      entityType: type.entityType,
      label: type.displayNamePlural || type.displayName || type.entityType,
      total: records.length,
      byState,
      errorCount,
    }
  }))

  return perType
}

/** Journey-shaped flows (passenger/flight "My Journey" data) from journey-service. */
async function journeyFlows () {
  const result = await proxy.get(`${config.JOURNEY_SERVICE_URL}/api/v1/journeys`)
  if (!result.ok) return []
  const journeys = Array.isArray(result.data) ? result.data : result.data?.journeys ?? []

  const byType = {}
  for (const j of journeys) {
    const entityType = j.entityType || j.entity_type || 'journey'
    const bucket = byType[entityType] ??= {
      entityType, label: entityType, total: 0, byState: {}, errorCount: 0,
    }
    bucket.total += 1
    const state = j.status || 'unknown'
    bucket.byState[state] = (bucket.byState[state] || 0) + 1
    if (state === 'cancelled' || state === 'offloaded' || state === 'failed') bucket.errorCount += 1
  }
  return Object.values(byType)
}

async function trafficStatus () {
  const result = await proxy.get(`${config.TRAFFIC_BOT_URL}/api/v1/status`)
  if (result.ok) return result.data
  return { running: false, source: 'unreachable' }
}

/** Named fault-gate state from every service that owns a FaultGateRegistry, plus the
 * local in-memory state for the infra-level scenarios (db-slowdown, llm-latency,
 * memory-pressure) that don't have one. */
async function faultGateStatus () {
  const [customer, ops, journey] = await Promise.all([
    proxy.get(`${config.CUSTOMER_ENTITY_SERVICE_URL}/api/v1/admin/fault-gates`),
    proxy.get(`${config.OPS_ENTITY_SERVICE_URL}/api/v1/admin/fault-gates`),
    proxy.get(`${config.JOURNEY_SERVICE_URL}/api/v1/admin/fault-gates`),
  ])
  return {
    'customer-entity-service': customer.ok ? customer.data : {},
    'ops-entity-service': ops.ok ? ops.data : {},
    'journey-service': journey.ok ? journey.data : {},
    infra: getFaults(),
  }
}

async function getCommandCenterStatus () {
  const [entity, journey, traffic, gates] = await Promise.all([
    entityFlows(),
    journeyFlows(),
    trafficStatus(),
    faultGateStatus(),
  ])

  return {
    flows: [...entity, ...journey],
    traffic,
    scenario: getActiveScenario(),
    faultGates: gates,
  }
}

module.exports = { getCommandCenterStatus }

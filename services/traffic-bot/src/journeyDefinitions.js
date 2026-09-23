'use strict'

const data = require('./data')

// These are the stable, cross-industry journeys
const BASE_JOURNEYS = {
  browsing: {
    weight: 25,
    steps: [
      { method: 'get', path: () => data.getPath('incidents') },
      { method: 'get', path: () => data.getPath('assets') },
      { method: 'get', path: () => data.getPath('buildings') },
    ]
  },
  'account-creation': {
    weight: 20,
    steps: [
      { 
        method: 'post', 
        path: '/api/v1/citizens', 
        body: () => data.generateCitizen() 
      },
      { 
        method: 'get', 
        path: (ctx) => `/api/v1/citizens/${ctx.id}` 
      },
    ]
  },
  'service-request': {
    weight: 25,
    steps: [
      { 
        method: 'post', 
        path: '/api/v1/citizens', 
        body: () => data.generateCitizen() 
      },
      { 
        method: 'post', 
        path: '/api/v1/service-requests', 
        body: (ctx) => data.generateServiceRequest(ctx.id) 
      },
    ]
  },
  purchase: {
    weight: 20,
    steps: [
      { method: 'get', path: '/api/v1/store/products' },
      { method: 'post', path: '/api/v1/store/orders', body: { item_id: 'prod_123', quantity: 1 } },
    ]
  },
  'tax-payment': {
    weight: 15,
    steps: [
      { method: 'get', path: '/api/v1/taxes/balance' },
      { method: 'post', path: '/api/v1/taxes/payment', body: { amount: 100 } },
    ]
  },
  chatbot: {
    weight: 5,
    steps: [
      { 
        method: 'post', 
        path: '/api/v1/chat', 
        body: () => ({ question: data.randomChatQuestion() }) 
      },
    ]
  },
  'iot-incident': {
    weight: 8,
    steps: [
      { method: 'post', path: '/api/v1/systems/anomaly', body: { type: 'critical' } },
    ]
  }
}

// Dynamic flow generation based on the Industry Config (passed via process.env.INDUSTRY_FLOWS)
function generateDynamicJourneys() {
  try {
    const flowsConfig = JSON.parse(process.env.INDUSTRY_FLOWS || '{}')
    const dynamic = {}
    for (const [flowId, config] of Object.entries(flowsConfig)) {
      const entityType = config.entityType
      dynamic[flowId] = {
        weight: 10,
        steps: [
          { method: 'get', path: `/api/v1/entities/${entityType}` },
          { method: 'get', path: (ctx) => `/api/v1/entities/${entityType}/${ctx.id}` },
        ]
      }
    }
    return dynamic
  } catch (e) {
    console.error('Failed to parse INDUSTRY_FLOWS config, skipping dynamic journeys', e)
    return {}
  }
}

const JOURNEY_DEFINITIONS = { ...BASE_JOURNEYS, ...generateDynamicJourneys() }

module.exports = { JOURNEY_DEFINITIONS }

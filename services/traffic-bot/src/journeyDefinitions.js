'use strict'

const data = require('./data')

const JOURNEY_DEFINITIONS = {
  browsing: {
    weight: 25,
    steps: [
      { method: 'get', path: '/api/v1/incidents' },
      { method: 'get', path: '/api/v1/assets' },
      { method: 'get', path: '/api/v1/city/buildings' },
    ]
  },
  accountCreation: {
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
  citizenRequest: {
    weight: 25,
    steps: [
      { 
        method: 'post', 
        path: '/api/v1/citizens', 
        body: () => data.generateCitizen() 
      },
      { 
        method: 'post', 
        path: '/api/v1/requests', 
        body: (ctx) => data.generateServiceRequest(ctx.id) 
      },
    ]
  },
  storePurchase: {
    weight: 20,
    steps: [
      { method: 'get', path: '/api/v1/store/products' },
      { method: 'post', path: '/api/v1/store/orders', body: { item_id: 'prod_123', quantity: 1 } },
    ]
  },
  payTax: {
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
  injectAnomaly: {
    weight: 8,
    steps: [
      { method: 'post', path: '/api/v1/systems/anomaly', body: { type: 'critical' } },
    ]
  }
}

module.exports = { JOURNEY_DEFINITIONS }

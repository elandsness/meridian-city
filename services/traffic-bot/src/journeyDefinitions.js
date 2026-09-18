'use strict'

const data = require('./data')

const JOURNEY_DEFINITIONS = {
  browsing: {
    weight: 25,
    steps: [
      { method: 'get', path: () => data.getPath('incidents') },
      { method: 'get', path: () => data.getPath('assets') },
      { method: 'get', path: () => data.getPath('buildings') },
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
        path: '/api/v1/service-requests', 
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
  },
  // --- Industry Specifics ---
  // Map these to the generic entity endpoints used by the entity engine
  flight_departure: {
    weight: 10,
    steps: [
      { method: 'get', path: '/api/v1/entities/flight_departure' },
      { method: 'get', path: (ctx) => `/api/v1/entities/flight_departure/${ctx.id}` },
    ]
  },
  passenger: {
    weight: 10,
    steps: [
      { method: 'post', path: '/api/v1/entities/passenger', body: () => ({ flight_departure_id: 'fltd_123' }) },
    ]
  }
}

module.exports = { JOURNEY_DEFINITIONS }

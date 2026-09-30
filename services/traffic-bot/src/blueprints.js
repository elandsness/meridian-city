'use strict'

const data = require('./data')

/**
 * Journey Blueprints define "How" a specific type of business interaction happens.
 * They return a sequence of steps for the genericJourney engine.
 */
const BLUEPRINTS = {
  /**
   * Registration Blueprint: Creates a new citizen/account.
   */
  registration: {
    name: 'Registration',
    steps: [
      { 
        method: 'post', 
        path: '/api/v1/citizens', 
        body: () => data.generateCitizen() 
      },
      { 
        method: 'get', 
        path: (ctx) => `/api/v1/citizens/${ctx.id}` 
      }
    ]
  },

  /**
   * Service Request Blueprint: Reports an incident.
   */
  serviceRequest: {
    name: 'Service Request',
    steps: [
      {
        method: 'post',
        path: data.getPath('incidents'),
        body: (ctx) => data.generateServiceRequest(ctx.citizen_id || 'unknown')
      }
    ]
  },

  /**
   * Browsing Blueprint: Simulates checking lists of entities.
   */
  browsing: {
    name: 'Browsing',
    steps: [
      { method: 'get', path: data.getPath('buildings') },
      { method: 'get', path: data.getPath('assets') }
    ]
  },

  /**
   * Chatbot Blueprint: Simulates asking a question.
   */
  chatbot: {
    name: 'Chatbot',
    steps: [
      { 
        method: 'post', 
        path: '/api/v1/chat', 
        body: () => ({ question: data.randomChatQuestion() }) 
      }
    ]
  }
}

module.exports = BLUEPRINTS

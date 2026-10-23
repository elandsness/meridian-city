"use strict"

module.exports = [
  { 
    prefix: '/api/v1/citizens', 
    targetKey: 'IDENTITY_SERVICE_URL', 
    serviceName: 'identity-service', 
    rewritePrefix: '/api/v1/identity' 
  },
  { 
    prefix: '/api/v1/passengers', 
    targetKey: 'JOURNEY_SERVICE_URL', 
    serviceName: 'journey-service', 
    rewritePrefix: '/api/v1/journeys' 
  },
  { 
    prefix: '/api/v1/flights', 
    targetKey: 'OPS_ENTITY_SERVICE_URL', 
    serviceName: 'ops-entity-service', 
    rewritePrefix: '/api/v1/entities/flight' 
  },
  { 
    prefix: '/api/v1/service-requests', 
    targetKey: 'CUSTOMER_ENTITY_SERVICE_URL', 
    serviceName: 'customer-entity-service', 
    rewritePrefix: '/api/v1/entities/service_request' 
  },
  {
    prefix: '/api/v1/entities/incident',
    targetKey: 'OPS_ENTITY_SERVICE_URL',
    serviceName: 'ops-entity-service',
  },
  {
    prefix: '/api/v1/entities/work_order',
    targetKey: 'OPS_ENTITY_SERVICE_URL',
    serviceName: 'ops-entity-service',
  },
  {
    prefix: '/api/v1/entities/journey',
    targetKey: 'JOURNEY_SERVICE_URL',
    serviceName: 'journey-service',
    rewritePrefix: '/api/v1/journeys',
  },
  {
    prefix: '/api/v1/entities',
    targetKey: 'CUSTOMER_ENTITY_SERVICE_URL',
    serviceName: 'customer-entity-service',
  },
];

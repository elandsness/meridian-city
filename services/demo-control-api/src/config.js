'use strict'

/**
 * Centralised config for demo-control-api.
 * All values are read from environment variables with sensible local defaults.
 */
module.exports = {
  PORT: parseInt(process.env.PORT || '3001', 10),
  K8S_NAMESPACE: process.env.K8S_NAMESPACE || 'meridian',

  // Downstream service URLs
  CITIZEN_SERVICE_URL:      process.env.CITIZEN_SERVICE_URL      || 'http://localhost:8081',
  AI_SERVICE_URL:           process.env.AI_SERVICE_URL           || 'http://localhost:8085',
  IOT_SIMULATOR_URL:        process.env.IOT_SIMULATOR_URL        || 'http://localhost:8088',
  TRAFFIC_BOT_URL:          process.env.TRAFFIC_BOT_URL          || 'http://localhost:8089',
  ANALYTICS_SERVICE_URL:    process.env.ANALYTICS_SERVICE_URL    || 'http://analytics-service:8084',
  JOURNEY_SERVICE_URL:      process.env.JOURNEY_SERVICE_URL      || 'http://localhost:8093',
  CUSTOMER_ENTITY_SERVICE_URL: process.env.CUSTOMER_ENTITY_SERVICE_URL || 'http://localhost:8094',
  OPS_ENTITY_SERVICE_URL:      process.env.OPS_ENTITY_SERVICE_URL      || 'http://localhost:8094',
}

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
  CITY_OPERATIONS_URL:      process.env.CITY_OPERATIONS_URL      || 'http://localhost:8083',
  AI_SERVICE_URL:           process.env.AI_SERVICE_URL           || 'http://localhost:8085',
  TELEMETRY_PROCESSOR_URL:  process.env.TELEMETRY_PROCESSOR_URL  || 'http://localhost:8086',
  IOT_SIMULATOR_URL:        process.env.IOT_SIMULATOR_URL        || 'http://localhost:8088',
  TRAFFIC_BOT_URL:          process.env.TRAFFIC_BOT_URL          || 'http://localhost:8089',
  ANALYTICS_SERVICE_URL:    process.env.ANALYTICS_SERVICE_URL    || 'http://analytics-service:8084',
  COMMERCE_SERVICE_URL:     process.env.COMMERCE_SERVICE_URL     || 'http://localhost:8090',
  BILLING_SERVICE_URL:      process.env.BILLING_SERVICE_URL      || 'http://localhost:8091',
  FLIGHT_OPS_URL:           process.env.FLIGHT_OPS_URL           || 'http://localhost:8092',
  PASSENGER_SERVICE_URL:    process.env.PASSENGER_SERVICE_URL    || 'http://localhost:8093',
}

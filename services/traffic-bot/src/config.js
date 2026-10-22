'use strict'

const industryConfig = process.env.INDUSTRY_CONFIG ? JSON.parse(process.env.INDUSTRY_CONFIG) : {};
const flows = industryConfig.dynatrace?.flows || industryConfig.analytics?.flows || [];

module.exports = {
  PORT: parseInt(process.env.PORT || '8089', 10),
  TARGET_URL: process.env.TARGET_URL || 'http://localhost:3000',
  REQUESTS_PER_MINUTE: parseInt(process.env.REQUESTS_PER_MINUTE || '8', 10),

  SCENARIOS: flows.reduce((acc, flow) => {
    const id = typeof flow === 'string' ? flow : flow.id;
    if (id) acc[id] = true;
    return acc;
  }, {}),

  INDUSTRY_CONFIG: industryConfig
}
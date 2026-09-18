'use strict'

const industryConfig = process.env.INDUSTRY_CONFIG ? JSON.parse(process.env.INDUSTRY_CONFIG) : {};
const flows = industryConfig.analytics?.flows || [];

module.exports = {
  PORT: parseInt(process.env.PORT || '8089', 10),

  // API gateway (all journey HTTP calls go through here)
  TARGET_URL: process.env.TARGET_URL || 'http://localhost:3000',

  // Base load level — journeys per minute in normal mode.
  REQUESTS_PER_MINUTE: parseInt(process.env.REQUESTS_PER_MINUTE || '8', 10),

  // Which journey types are enabled. 
  // Driven by the Industry Config's analytics flows.
  // Fallback to env vars for backward compatibility or manual override.
  SCENARIOS: {
    citizenRequests: flows.includes('service-request') || process.env.SCENARIO_CITIZEN_REQUESTS !== 'false',
    accountCreation: flows.includes('account-creation') || process.env.SCENARIO_ACCOUNT_CREATION !== 'false',
    browsing:        flows.includes('browsing') || process.env.SCENARIO_BROWSING !== 'false',
    storePurchase:   flows.includes('purchase') || process.env.SCENARIO_STORE_PURCHASE !== 'false',
    payTax:          flows.includes('tax-payment') || process.env.SCENARIO_PAY_TAX !== 'false',
    injectAnomaly:   flows.includes('iot-incident') || process.env.SCENARIO_INJECT_ANOMALY !== 'false',
    chatbot:         flows.includes('chatbot') || process.env.SCENARIO_CHATBOT !== 'false',
    // Allow for industry-specific ones too
    ...flows.reduce((acc, flow) => {
      acc[flow] = true;
      return acc;
    }, {}),
  },
  
  INDUSTRY_CONFIG: industryConfig
}

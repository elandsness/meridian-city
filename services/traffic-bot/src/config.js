'use strict'

module.exports = {
  PORT: parseInt(process.env.PORT || '8089', 10),

  // API gateway (all journey HTTP calls go through here)
  TARGET_URL: process.env.TARGET_URL || 'http://localhost:3000',

  // Base load level — journeys per minute in normal mode
  REQUESTS_PER_MINUTE: parseInt(process.env.REQUESTS_PER_MINUTE || '60', 10),

  // Which journey types are enabled (matches Helm config values)
  SCENARIOS: {
    citizenRequests: process.env.SCENARIO_CITIZEN_REQUESTS !== 'false',
    accountCreation: process.env.SCENARIO_ACCOUNT_CREATION !== 'false',
    browsing:        process.env.SCENARIO_BROWSING        !== 'false',
    storePurchase:   process.env.SCENARIO_STORE_PURCHASE  !== 'false',
    chatbot:         process.env.SCENARIO_CHATBOT         === 'true',  // off by default
  },
}

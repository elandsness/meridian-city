'use strict'

/**
 * Transit map routes — schematic topology + live vehicle/status for the public
 * transit map on the portal home page. Read-only and public (no operator auth);
 * the api-gateway exposes these under /api/v1/transit/* (forwarded verbatim).
 */

const { getLines, getStatus } = require('../transit')

async function transitRoutes (fastify) {
  // GET /api/v1/transit/lines — static schematic topology (lines + stops + coords)
  fastify.get('/api/v1/transit/lines', async () => getLines())

  // GET /api/v1/transit/status — live vehicle positions + per-line status
  fastify.get('/api/v1/transit/status', async () => getStatus())
}

module.exports = transitRoutes

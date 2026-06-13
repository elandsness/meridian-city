'use strict'

const { request: undiciRequest } = require('undici')

async function authRoutes (fastify, opts) {
  const config = opts.config

  // Login dispatcher:
  //   1. Built-in operator login (demo / dynatrace) — handled locally, mints an
  //      operator JWT. Used by both dashboards.
  //   2. Otherwise, treat the username as a citizen email and verify the password
  //      against citizen-service. On success, mint a citizen JWT carrying the
  //      citizen id so the public portal can attach it to requests.
  fastify.post('/api/v1/auth/login', async (request, reply) => {
    const { username, password } = request.body || {}

    if (!username || !password) {
      return reply.code(400).send({ error: 'username and password are required' })
    }

    // 1. Operator login (unchanged).
    if (username === config.AUTH_USERNAME && password === config.AUTH_PASSWORD) {
      const token = fastify.jwt.sign({ sub: username, role: 'operator' }, { expiresIn: '8h' })
      request.log.info({ username }, 'operator login')
      return reply.code(200).send({ token, user: { username, role: 'operator' } })
    }

    // 2. Citizen login — verify credentials against citizen-service.
    try {
      const res = await undiciRequest(`${config.CITIZEN_SERVICE_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: username, password }),
        headersTimeout: 5000,
        bodyTimeout: 5000,
      })

      if (res.statusCode >= 200 && res.statusCode < 300) {
        const citizen = await res.body.json()
        const token = fastify.jwt.sign(
          { sub: citizen.citizen_id, role: 'citizen' },
          { expiresIn: '8h' }
        )
        request.log.info({ citizenId: citizen.citizen_id }, 'citizen login')
        return reply.code(200).send({
          token,
          user: {
            id: citizen.citizen_id,
            username: citizen.email,
            name: citizen.name,
            role: 'citizen',
          },
        })
      }

      // Non-2xx (typically 401 invalid credentials). Drain the body and reject.
      await res.body.text().catch(() => {})
      return reply.code(401).send({ error: 'Invalid credentials' })
    } catch (err) {
      request.log.error({ err: err.message }, 'citizen login upstream failed')
      return reply.code(502).send({ error: 'Authentication service unavailable' })
    }
  })

  fastify.get('/api/v1/auth/verify', {
    preHandler: [fastify.authenticateOps],
  }, async (request, reply) => {
    return reply.code(200).send({
      valid: true,
      sub: request.user.sub,
    })
  })
}

module.exports = authRoutes

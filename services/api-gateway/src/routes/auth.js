"use strict"

const { request: undiciRequest } = require('undici')

async function authRoutes (fastify, opts) {
  const config = opts.config

  fastify.get('/api/v1/auth/me', async (request, reply) => {
    const citizenAuthUrl = config.IDENTITY_SERVICE_URL || config.CUSTOMER_ENTITY_SERVICE_URL || config.CITIZEN_SERVICE_URL
    try {
      const res = await undiciRequest(`${citizenAuthUrl}/api/v1/auth/me`, {
        method: 'GET',
        headers: { 
          'Authorization': request.headers.authorization,
          'content-type': 'application/json' 
        },
        headersTimeout: 5000,
        bodyTimeout: 5000,
      })
      if (res.statusCode >= 200 && res.statusCode < 300) {
        return reply.code(200).send(await res.body.json())
      }
      await res.body.text().catch(() => {})
      return reply.code(res.statusCode).send({ error: 'Identity service error' })
    } catch (err) {
      request.log.error({ err: err.message }, 'auth /me upstream failed')
      return reply.code(502).send({ error: 'Authentication service unavailable' })
    }
  })

  fastify.post('/api/v1/auth/login', async (request, reply) => {
    const { username, password } = request.body || {}
    if (!username || !password) return reply.code(400).send({ error: 'username and password are required' })

    if (username === config.AUTH_USERNAME && password === config.AUTH_PASSWORD) {
      const token = fastify.jwt.sign({ sub: username, role: 'operator' }, { expiresIn: '8h' })
      return reply.code(200).send({ token, user: { username, role: 'operator' } })
    }

    const citizenAuthUrl = config.IDENTITY_SERVICE_URL || config.CUSTOMER_ENTITY_SERVICE_URL || config.CITIZEN_SERVICE_URL
    try {
      const res = await undiciRequest(`${citizenAuthUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: username, password }),
        headersTimeout: 5000,
        bodyTimeout: 5000,
      })
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const identity = await res.body.json()
        const token = fastify.jwt.sign({ sub: identity.identity_id, role: 'citizen' }, { expiresIn: '8h' })
        return reply.code(200).send({
          token,
          user: { id: identity.identity_id, username: identity.email, name: identity.name, role: 'citizen' },
        })
      }
      await res.body.text().catch(() => {})
      return reply.code(401).send({ error: 'Invalid credentials' })
    } catch (err) {
      request.log.error({ err: err.message }, 'citizen login upstream failed')
      return reply.code(502).send({ error: 'Authentication service unavailable' })
    }
  })

  fastify.get('/api/v1/auth/verify', { preHandler: [fastify.authenticateOps] }, async (request, reply) => {
    return reply.code(200).send({ valid: true, sub: request.user.sub })
  })
}

module.exports = authRoutes

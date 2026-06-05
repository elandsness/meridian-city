'use strict'

async function authRoutes (fastify, opts) {
  const config = opts.config

  fastify.post('/api/v1/auth/login', async (request, reply) => {
    const { username, password } = request.body || {}

    if (!username || !password) {
      return reply.code(400).send({ error: 'username and password are required' })
    }

    if (username !== config.AUTH_USERNAME || password !== config.AUTH_PASSWORD) {
      return reply.code(401).send({ error: 'Invalid credentials' })
    }

    const token = fastify.jwt.sign(
      { sub: username, role: 'operator' },
      { expiresIn: '8h' }
    )

    request.log.info({ username }, 'successful login')

    return reply.code(200).send({
      token,
      user: { username, role: 'operator' },
    })
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

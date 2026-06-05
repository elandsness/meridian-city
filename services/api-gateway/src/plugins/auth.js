'use strict'

const fp = require('fastify-plugin')
const jwt = require('@fastify/jwt')

async function authPlugin (fastify, opts) {
  const secret = opts.config.JWT_SECRET

  await fastify.register(jwt, {
    secret,
  })

  fastify.decorate('authenticateOps', async function (request, reply) {
    try {
      await request.jwtVerify()
    } catch (err) {
      reply.code(401).send({ error: 'Unauthorized', message: err.message })
    }
  })
}

module.exports = fp(authPlugin, {
  name: 'auth-plugin',
  dependencies: [],
})

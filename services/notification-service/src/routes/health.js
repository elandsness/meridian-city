'use strict'

const { Router } = require('express')
const { getCount, clientCount } = require('../notifications')

const router = Router()

router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'notification-service',
    notifications_buffered: getCount(),
    sse_clients_connected: clientCount(),
  })
})

module.exports = router

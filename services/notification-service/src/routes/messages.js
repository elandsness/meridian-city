'use strict'

/**
 * Per-citizen messages inbox routes.
 *
 * GET  /api/v1/messages?citizen_id=&unread_only=&limit=
 * POST /api/v1/messages/:id/read
 * POST /api/v1/messages/read-all?citizen_id=
 */

const { Router } = require('express')
const { listForCitizen, markRead, markAllRead } = require('../messages')

const router = Router()

router.get('/', async (req, res, next) => {
  try {
    const { messages, unread } = await listForCitizen(req.query.citizen_id, {
      unreadOnly: req.query.unread_only === 'true',
      limit: req.query.limit,
    })
    res.json({ messages, unread, total: messages.length })
  } catch (err) {
    next(err)
  }
})

router.post('/:id/read', async (req, res, next) => {
  try {
    await markRead(req.params.id)
    res.status(204).end()
  } catch (err) {
    next(err)
  }
})

router.post('/read-all', async (req, res, next) => {
  try {
    await markAllRead(req.query.citizen_id)
    res.status(204).end()
  } catch (err) {
    next(err)
  }
})

module.exports = router

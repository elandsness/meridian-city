'use strict'

/**
 * Per-owner messages inbox routes (owner = whichever industry's own "owner"
 * concept -- citizen, passenger, etc).
 *
 * GET    /api/v1/messages?owner_id=&unread_only=&limit=
 * POST   /api/v1/messages/:id/read
 * POST   /api/v1/messages/read-all?owner_id=
 * DELETE /api/v1/messages           — purge all messages (demo reset)
 */

const { Router } = require('express')
const { listForOwner, markRead, markAllRead, purgeAll } = require('../messages')

const router = Router()

router.get('/', async (req, res, next) => {
  try {
    const { messages, unread } = await listForOwner(req.query.owner_id, {
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
    await markAllRead(req.query.owner_id)
    res.status(204).end()
  } catch (err) {
    next(err)
  }
})

router.delete('/', async (req, res, next) => {
  try {
    await purgeAll()
    res.status(204).end()
  } catch (err) {
    next(err)
  }
})

module.exports = router

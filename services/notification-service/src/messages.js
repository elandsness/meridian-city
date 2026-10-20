'use strict'

/**
 * Per-owner messages inbox store (Postgres). All calls are safe no-ops until
 * the DB schema is ready (db.init()).
 */

const { v4: uuidv4 } = require('uuid')
const { getPool, isReady } = require('./db')

async function insert ({ ownerId, type, title, body, metadata }) {
  if (!isReady() || !ownerId) return null
  const id = uuidv4()
  await getPool().query(
    `INSERT INTO messages.messages (id, owner_id, type, title, body, read, metadata)
     VALUES ($1, $2, $3, $4, $5, false, $6)`,
    [id, ownerId, type || 'info', title || '', body || '', metadata ? JSON.stringify(metadata) : null]
  )
  console.log(JSON.stringify({ level: 'info', msg: 'inbox message created', owner_id: ownerId, type }))
  return id
}

async function listForOwner (ownerId, { unreadOnly = false, limit = 50 } = {}) {
  if (!isReady() || !ownerId) return { messages: [], unread: 0 }
  const lim = Math.min(parseInt(limit, 10) || 50, 200)
  const where = unreadOnly ? 'owner_id = $1 AND read = false' : 'owner_id = $1'
  const messages = (await getPool().query(
    `SELECT id, owner_id, type, title, body, read, created_at\n     FROM messages.messages WHERE ${where} ORDER BY created_at DESC LIMIT $2`,
    [ownerId, lim]
  )).rows
  const unread = (await getPool().query(
    'SELECT COUNT(*)::int AS c FROM messages.messages WHERE owner_id = $1 AND read = false',
    [ownerId]
  )).rows[0].c
  return { messages, unread }
}

async function markRead (id) {
  if (!isReady()) return
  await getPool().query('UPDATE messages.messages SET read = true WHERE id = $1', [id])
}

async function markAllRead (ownerId) {
  if (!isReady() || !ownerId) return
  await getPool().query('UPDATE messages.messages SET read = true WHERE owner_id = $1', [ownerId])
}

async function purgeAll () {
  if (!isReady()) return
  await getPool().query('TRUNCATE messages.messages')
  console.log(JSON.stringify({ level: 'info', msg: 'inbox purged (all messages deleted)' }))
}

module.exports = { insert, listForOwner, markRead, markAllRead, purgeAll }

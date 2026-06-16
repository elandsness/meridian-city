'use strict'

/**
 * Per-citizen messages inbox store (Postgres). All calls are safe no-ops until
 * the DB schema is ready (db.init()).
 */

const { v4: uuidv4 } = require('uuid')
const { getPool, isReady } = require('./db')

async function insert ({ citizenId, type, title, body, metadata }) {
  if (!isReady() || !citizenId) return null
  const id = uuidv4()
  await getPool().query(
    `INSERT INTO messages.messages (id, citizen_id, type, title, body, read, metadata)
     VALUES ($1, $2, $3, $4, $5, false, $6)`,
    [id, citizenId, type || 'info', title || '', body || '', metadata ? JSON.stringify(metadata) : null]
  )
  console.log(JSON.stringify({ level: 'info', msg: 'inbox message created', citizen_id: citizenId, type }))
  return id
}

async function listForCitizen (citizenId, { unreadOnly = false, limit = 50 } = {}) {
  if (!isReady() || !citizenId) return { messages: [], unread: 0 }
  const lim = Math.min(parseInt(limit, 10) || 50, 200)
  const where = unreadOnly ? 'citizen_id = $1 AND read = false' : 'citizen_id = $1'
  const messages = (await getPool().query(
    `SELECT id, citizen_id, type, title, body, read, created_at
     FROM messages.messages WHERE ${where} ORDER BY created_at DESC LIMIT ${lim}`,
    [citizenId]
  )).rows
  const unread = (await getPool().query(
    'SELECT COUNT(*)::int AS c FROM messages.messages WHERE citizen_id = $1 AND read = false',
    [citizenId]
  )).rows[0].c
  return { messages, unread }
}

async function markRead (id) {
  if (!isReady()) return
  await getPool().query('UPDATE messages.messages SET read = true WHERE id = $1', [id])
}

async function markAllRead (citizenId) {
  if (!isReady() || !citizenId) return
  await getPool().query('UPDATE messages.messages SET read = true WHERE citizen_id = $1', [citizenId])
}

module.exports = { insert, listForCitizen, markRead, markAllRead }

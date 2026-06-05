'use strict'

/**
 * In-memory notification ring buffer + SSE client registry.
 *
 * push(notification)     — add a notification, broadcast to all SSE clients
 * getRecent(limit)       — return the last N notifications
 * getCount()             — total notifications in the buffer
 * clear()                — empty the buffer (used by demo reset)
 * addClient(res)         — register an SSE client; returns a cleanup function
 */

const { v4: uuidv4 } = require('uuid')

const MAX_BUFFER = parseInt(process.env.NOTIFICATION_BUFFER_SIZE || '200', 10)

/** @type {Array<object>} */
const _buffer = []

/** @type {Set<import('http').ServerResponse>} */
const _clients = new Set()

/**
 * Add a notification to the ring buffer and broadcast to SSE clients.
 * @param {{ type: string, severity: string, title: string, message: string, metadata?: object }} n
 * @returns {object} The stored notification with id + timestamp
 */
function push (n) {
  const notification = {
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    type: n.type || 'info',
    severity: n.severity || 'info',
    title: n.title || '',
    message: n.message || '',
    metadata: n.metadata || {},
  }

  _buffer.push(notification)
  if (_buffer.length > MAX_BUFFER) {
    _buffer.shift()
  }

  const ssePayload = `data: ${JSON.stringify(notification)}\n\n`
  for (const client of _clients) {
    try {
      client.write(ssePayload)
    } catch {
      _clients.delete(client)
    }
  }

  return notification
}

/**
 * Return the last `limit` notifications (most recent last).
 * @param {number} limit
 */
function getRecent (limit = 50) {
  const n = Math.min(limit, MAX_BUFFER)
  return _buffer.slice(-n)
}

/** Return the total number of notifications currently in the buffer. */
function getCount () {
  return _buffer.length
}

/** Clear all notifications from the buffer. */
function clear () {
  _buffer.length = 0
}

/**
 * Register an Express response as an SSE client.
 * Returns a cleanup function that removes the client from the registry.
 * @param {import('http').ServerResponse} res
 * @returns {() => void}
 */
function addClient (res) {
  _clients.add(res)
  return () => _clients.delete(res)
}

/** Return the number of currently connected SSE clients. */
function clientCount () {
  return _clients.size
}

module.exports = { push, getRecent, getCount, clear, addClient, clientCount }

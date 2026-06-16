'use strict'

/**
 * Postgres access for the per-citizen messages inbox. Owns the `messages` schema,
 * created at startup (runtime DDL, mirroring telemetry-processor/db.py). Non-fatal:
 * if the DB is unreachable the service still serves notifications; inbox calls no-op
 * until init() succeeds.
 */

const { Pool } = require('pg')

let _pool = null
let _ready = false

function getPool () {
  if (!_pool) {
    _pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'meridian',
      user: process.env.DB_USER || 'meridian',
      password: process.env.DB_PASSWORD || 'meridian',
      max: 10,
    })
    _pool.on('error', (err) => {
      console.error(JSON.stringify({ level: 'error', msg: 'pg pool error', error: err.message }))
    })
  }
  return _pool
}

async function init () {
  const pool = getPool()
  await pool.query('CREATE SCHEMA IF NOT EXISTS messages')
  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages.messages (
      id UUID PRIMARY KEY,
      citizen_id VARCHAR(50) NOT NULL,
      type VARCHAR(40),
      title TEXT,
      body TEXT,
      read BOOLEAN NOT NULL DEFAULT FALSE,
      metadata JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await pool.query(
    'CREATE INDEX IF NOT EXISTS idx_messages_citizen ON messages.messages (citizen_id, created_at DESC)'
  )
  _ready = true
  console.log(JSON.stringify({ level: 'info', msg: 'messages schema ready' }))
}

function isReady () {
  return _ready
}

module.exports = { getPool, init, isReady }

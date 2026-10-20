'use strict'

/**
 * Postgres access for the per-owner messages inbox (works for any industry's
 * "owner" concept -- citizen, passenger, etc; see EntityKafkaPublisher's
 * generator.ownerField). Owns the `messages` schema, created at startup via
 * runtime DDL. Non-fatal: if the DB is
 * unreachable the service still serves notifications; inbox calls no-op until
 * init() succeeds.
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
      owner_id VARCHAR(50) NOT NULL,
      type VARCHAR(40),
      title TEXT,
      body TEXT,
      read BOOLEAN NOT NULL DEFAULT FALSE,
      metadata JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  // Migrate any table created before the citizen_id -> owner_id rename (the column was
  // city-specific; this inbox serves every industry's own "owner" concept).
  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'messages' AND table_name = 'messages' AND column_name = 'citizen_id'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'messages' AND table_name = 'messages' AND column_name = 'owner_id'
      ) THEN
        ALTER TABLE messages.messages RENAME COLUMN citizen_id TO owner_id;
      END IF;
    END $$;
  `)
  await pool.query('ALTER INDEX IF EXISTS idx_messages_citizen RENAME TO idx_messages_owner')
  await pool.query(
    'CREATE INDEX IF NOT EXISTS idx_messages_owner ON messages.messages (owner_id, created_at DESC)'
  )
  _ready = true
  console.log(JSON.stringify({ level: 'info', msg: 'messages schema ready' }))
}

function isReady () {
  return _ready
}

module.exports = { getPool, init, isReady }

'use strict'

/**
 * Lightweight HTTP proxy utility using undici.
 *
 * Used by routes to forward fault/fleet/traffic commands to downstream services.
 * All functions return { ok, statusCode, data } — never throw so callers get
 * a clean error object rather than an unhandled rejection.
 */

const { request } = require('undici')

const DEFAULT_TIMEOUT_MS = 5000

/**
 * POST JSON to a URL.
 * @param {string} url
 * @param {object} body
 * @param {number} [timeoutMs]
 */
async function post (url, body = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  try {
    const { statusCode, body: responseBody } = await request(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      bodyTimeout: timeoutMs,
      headersTimeout: timeoutMs,
    })
    let data = {}
    try { data = await responseBody.json() } catch { await responseBody.text() }
    return { ok: statusCode >= 200 && statusCode < 300, statusCode, data }
  } catch (err) {
    return { ok: false, statusCode: 0, data: {}, error: err.message }
  }
}

/**
 * GET a URL.
 * @param {string} url
 * @param {number} [timeoutMs]
 */
async function get (url, timeoutMs = DEFAULT_TIMEOUT_MS) {
  try {
    const { statusCode, body: responseBody } = await request(url, {
      method: 'GET',
      bodyTimeout: timeoutMs,
      headersTimeout: timeoutMs,
    })
    let data = {}
    try { data = await responseBody.json() } catch { await responseBody.text() }
    return { ok: statusCode >= 200 && statusCode < 300, statusCode, data }
  } catch (err) {
    return { ok: false, statusCode: 0, data: {}, error: err.message }
  }
}

/**
 * DELETE a URL.
 * @param {string} url
 * @param {number} [timeoutMs]
 */
async function del (url, timeoutMs = DEFAULT_TIMEOUT_MS) {
  try {
    const { statusCode, body: responseBody } = await request(url, {
      method: 'DELETE',
      bodyTimeout: timeoutMs,
      headersTimeout: timeoutMs,
    })
    try { await responseBody.text() } catch { /* ignore */ }
    return { ok: statusCode >= 200 && statusCode < 300, statusCode }
  } catch (err) {
    return { ok: false, statusCode: 0, error: err.message }
  }
}

module.exports = { post, get, del }

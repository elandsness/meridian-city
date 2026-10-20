'use strict'

/**
 * Shared helpers for driving the iot-simulator's admin API.
 *
 * The simulator (services/iot-simulator/internal/admin/server.go) exposes:
 *   GET    /api/v1/iot/device-types          — configured fleet shape
 *   GET    /api/v1/iot/devices               — list devices (optional ?type=)
 *   POST   /api/v1/iot/devices               — add device(s): { type, count, parent_id }
 *   DELETE /api/v1/iot/devices/{id}          — remove a device (cascades to children)
 *   GET    /api/v1/iot/fault-gates           — list current fault gates by device type
 *   PUT    /api/v1/iot/fault-gates/{type}    — set an ongoing fault gate
 *   DELETE /api/v1/iot/fault-gates/{type}    — clear/disable a fault gate
 */

const config = require('./config')
const proxy = require('./proxy')

/**
 * Disable and clear every active fault gate (used by the scenario "reset
 * everything" flow).
 * @returns {Promise<{ok: boolean, cleared: string[], errors?: object[], error?: string}>}
 */
async function clearAllFaultGates () {
  const listResult = await proxy.get(`${config.IOT_SIMULATOR_URL}/api/v1/iot/fault-gates`)
  if (!listResult.ok) {
    return { ok: false, cleared: [], error: listResult.error || 'iot-simulator unreachable' }
  }
  const types = Object.keys(listResult.data?.gates || {})
  const cleared = []
  const errors = []
  for (const type of types) {
    const r = await proxy.del(`${config.IOT_SIMULATOR_URL}/api/v1/iot/fault-gates/${encodeURIComponent(type)}`)
    if (r.ok) cleared.push(type)
    else errors.push({ type, error: r.error })
  }
  return { ok: errors.length === 0, cleared, errors: errors.length ? errors : undefined }
}

module.exports = { clearAllFaultGates }

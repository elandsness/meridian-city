'use strict'

/**
 * Shared helpers for driving the iot-simulator's admin API.
 *
 * The simulator (services/iot-simulator/internal/admin/server.go) exposes:
 *   GET    /admin/fleet                 — fleet status { <cat>: { count, anomalies } }
 *   POST   /admin/fleet                 — resize { vehicles, buildings, machines }
 *   POST   /admin/anomaly               — { device_id, type, enabled }
 *   DELETE /admin/anomaly/{device_id}   — clear one device's anomaly
 *
 * NOTE the paths are /admin/* (not /api/v1/fleet/*) and the anomaly body uses
 * { device_id, type, enabled } — see docs/API_CONVENTIONS.md.
 */

const config = require('./config')
const proxy = require('./proxy')

/**
 * Map the UI's friendly anomaly names (per category) to the simulator's
 * device.AnomalyType vocabulary, so an injected anomaly produces a reading that
 * actually crosses the telemetry-processor thresholds (→ Kafka iot.anomalies →
 * city-operations incident). Unrecognised names fall back to a category default
 * that is guaranteed to breach its threshold.
 *
 * Simulator types: hvac_overtemp, engine_overtemp, high_vibration,
 * high_error_rate, high_speed.
 */
// Canonical simulator anomaly types per category (device.AnomalyType vocabulary).
const SIMULATOR_TYPES_BY_CATEGORY = {
  vehicle: ['engine_overtemp', 'high_speed'],
  building: ['hvac_overtemp'],
  machine: ['high_vibration', 'high_error_rate'],
}

// Back-compat aliases for the old UI's friendly names → simulator types.
const ANOMALY_TYPE_ALIASES = {
  engine_temp_spike: 'engine_overtemp',
  hvac_failure: 'hvac_overtemp',
}

/**
 * Resolve a (category, anomalyType) pair to the simulator's vocabulary, or null if
 * the type isn't valid for that category. Returning null instead of silently
 * defaulting lets the route reject bad input rather than inject the wrong fault
 * (which is what made every injection look like `engine_overtemp`).
 */
function resolveAnomalyType (category, anomalyType) {
  const valid = SIMULATOR_TYPES_BY_CATEGORY[category]
  if (!valid) return null
  const resolved = ANOMALY_TYPE_ALIASES[anomalyType] || anomalyType
  return valid.includes(resolved) ? resolved : null
}

/**
 * Clear every active device anomaly. The simulator only supports per-device
 * clears, so read the current anomalies from GET /admin/fleet and DELETE each.
 * @returns {Promise<{ok: boolean, cleared: string[], errors?: object[], error?: string}>}
 */
async function clearAllFleetAnomalies () {
  const status = await proxy.get(`${config.IOT_SIMULATOR_URL}/admin/fleet`)
  if (!status.ok) {
    return { ok: false, cleared: [], error: status.error || 'iot-simulator unreachable' }
  }
  const d = status.data || {}
  const ids = [
    ...Object.keys(d.vehicles?.anomalies || {}),
    ...Object.keys(d.buildings?.anomalies || {}),
    ...Object.keys(d.machines?.anomalies || {}),
  ]
  const cleared = []
  const errors = []
  for (const id of ids) {
    const r = await proxy.del(`${config.IOT_SIMULATOR_URL}/admin/anomaly/${encodeURIComponent(id)}`)
    if (r.ok) cleared.push(id)
    else errors.push({ id, error: r.error })
  }
  return { ok: errors.length === 0, cleared, errors: errors.length ? errors : undefined }
}

module.exports = { resolveAnomalyType, clearAllFleetAnomalies }

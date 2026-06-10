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
const ANOMALY_TYPE_BY_CATEGORY = {
  vehicle: {
    engine_temp_spike: 'engine_overtemp',
    engine_overtemp: 'engine_overtemp',
    high_speed: 'high_speed',
    _default: 'engine_overtemp',
  },
  building: {
    hvac_failure: 'hvac_overtemp',
    hvac_overtemp: 'hvac_overtemp',
    _default: 'hvac_overtemp',
  },
  machine: {
    high_vibration: 'high_vibration',
    high_error_rate: 'high_error_rate',
    _default: 'high_vibration',
  },
}

function resolveAnomalyType (category, anomalyType) {
  const map = ANOMALY_TYPE_BY_CATEGORY[category] || {}
  return map[anomalyType] || map._default || 'high_vibration'
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

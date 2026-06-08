'use strict'

/**
 * KafkaJS consumer for notification-service.
 *
 * Topics consumed:
 *   iot.anomalies    — IoT device anomaly events from telemetry-processor
 *   requests.events  — Service request lifecycle events from citizen-service / service-dispatch
 *
 * Each message is transformed into a notification and pushed to the in-memory
 * ring buffer (notifications.js), which broadcasts to SSE clients.
 *
 * Startup is non-fatal: if Kafka is unreachable the service still starts and
 * serves the REST endpoints. The consumer retries connection in the background.
 */

const { Kafka, logLevel } = require('kafkajs')
const { push } = require('./notifications')

const KAFKA_BROKERS = (process.env.KAFKA_BOOTSTRAP_SERVERS || 'kafka:9092').split(',')
const GROUP_ID = 'notification-service'

const kafka = new Kafka({
  clientId: GROUP_ID,
  brokers: KAFKA_BROKERS,
  logLevel: logLevel.WARN,
  retry: {
    initialRetryTime: 3000,
    retries: 20,
  },
})

const consumer = kafka.consumer({ groupId: GROUP_ID })

let _started = false

/**
 * Map an iot.anomalies Kafka message to a notification object.
 */
function mapAnomaly (payload) {
  const severity = payload.severity || 'warning'
  const deviceId = payload.device_id || payload.deviceId || 'unknown'
  const anomalyType = payload.anomaly_type || payload.anomalyType || 'anomaly'
  return {
    type: 'iot_anomaly',
    severity,
    title: `IoT Anomaly: ${deviceId}`,
    message: `${anomalyType} detected on device ${deviceId}` +
      (payload.metric_name ? ` (${payload.metric_name}: ${payload.value})` : ''),
    metadata: payload,
  }
}

/**
 * Map a requests.events Kafka message to a notification object.
 */
function mapRequestEvent (payload) {
  const eventType = payload.event_type || payload.eventType || 'update'
  const requestId = payload.request_id || payload.requestId || ''
  return {
    type: 'request_event',
    severity: 'info',
    title: `Request ${requestId}: ${eventType.replace(/_/g, ' ')}`,
    message: `Service request ${requestId} — ${eventType}`,
    metadata: payload,
  }
}

/**
 * Start the Kafka consumer. Non-fatal on initial connection error.
 */
async function start () {
  if (_started) return
  _started = true

  try {
    await consumer.connect()
    await consumer.subscribe({
      topics: ['iot.anomalies', 'requests.events'],
      fromBeginning: false,
    })

    await consumer.run({
      eachMessage: async ({ topic, message }) => {
        let payload
        try {
          payload = JSON.parse(message.value.toString())
        } catch {
          return // skip unparseable messages
        }

        try {
          if (topic === 'iot.anomalies') {
            push(mapAnomaly(payload))
          } else if (topic === 'requests.events') {
            push(mapRequestEvent(payload))
          }
        } catch (err) {
          console.error(JSON.stringify({
            level: 'error',
            msg: 'notification push failed',
            topic,
            error: err.message,
          }))
        }
      },
    })

    console.log(JSON.stringify({ level: 'info', msg: 'Kafka consumer started', topics: ['iot.anomalies', 'requests.events'] }))
  } catch (err) {
    console.error(JSON.stringify({ level: 'error', msg: 'Kafka consumer start failed (will not retry)', error: err.message }))
    _started = false
  }
}

async function stop () {
  try {
    await consumer.disconnect()
  } catch {
    // ignore disconnect errors on shutdown
  }
}

module.exports = { start, stop }

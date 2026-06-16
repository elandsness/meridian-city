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
const { insert } = require('./messages')

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

// ---- Per-citizen inbox mappers (DB-backed) --------------------------------

async function mapCommerceToInbox (payload) {
  const eventType = payload.eventType || payload.event_type
  const citizenId = payload.citizenId || payload.citizen_id
  const orderId = payload.orderId || payload.order_id
  if (eventType === 'order.delivered' && citizenId) {
    await insert({
      citizenId,
      type: 'order_delivered',
      title: 'Your package has arrived',
      body: `Order ${orderId} has been delivered. Enjoy your Meridian City merchandise!`,
      metadata: payload,
    })
  }
}

async function mapBillingToInbox (payload) {
  const eventType = payload.eventType || payload.event_type
  const citizenId = payload.citizenId || payload.citizen_id
  const period = payload.period || ''
  if (!citizenId) return
  if (eventType === 'tax.bill_issued') {
    await insert({
      citizenId,
      type: 'tax_due',
      title: `${period} tax bill issued`,
      body: `A new ${period} tax bill is now due. View it under Pay bills.`,
      metadata: payload,
    })
  } else if (eventType === 'tax.payment_completed') {
    await insert({
      citizenId,
      type: 'tax_paid',
      title: 'Tax payment received',
      body: `Thank you — your ${period} tax bill is paid.`,
      metadata: payload,
    })
  }
}

async function mapRequestToInbox (payload) {
  const eventType = payload.eventType || payload.event_type || ''
  const citizenId = payload.citizenId || payload.citizen_id
  const status = (payload.status || payload.new_status || '').toLowerCase()
  const requestId = payload.requestId || payload.request_id || ''
  if (!citizenId) return
  if (status === 'resolved' || eventType.includes('resolved')) {
    await insert({
      citizenId,
      type: 'request_resolved',
      title: 'Service request resolved',
      body: `Your request ${requestId} has been resolved.`,
      metadata: payload,
    })
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
      topics: ['iot.anomalies', 'requests.events', 'commerce.events', 'billing.events'],
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
            await mapRequestToInbox(payload)
          } else if (topic === 'commerce.events') {
            await mapCommerceToInbox(payload)
          } else if (topic === 'billing.events') {
            await mapBillingToInbox(payload)
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

    console.log(JSON.stringify({ level: 'info', msg: 'Kafka consumer started', topics: ['iot.anomalies', 'requests.events', 'commerce.events', 'billing.events'] }))
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

'use strict'

/**
 * KafkaJS consumer for notification-service.
 *
 * Topics consumed:
 *   requests.events  — Service request lifecycle events from entity-engine
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

// When set, only these comma-separated topics are subscribed. Lets industry
// configs (e.g. airport, which has no store/billing) suppress irrelevant inbox
// messages without touching the notification service code.
const ALL_TOPICS = ['requests.events', 'commerce.events', 'billing.events']
const ENABLED_TOPICS = process.env.ENABLED_TOPICS
  ? process.env.ENABLED_TOPICS.split(',').map((t) => t.trim()).filter(Boolean)
  : ALL_TOPICS

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

// ---- Per-owner inbox mappers (DB-backed) --------------------------------

async function mapCommerceToInbox (payload) {
  const eventType = payload.eventType || payload.event_type
  const ownerId = payload.ownerId || payload.owner_id
  const orderId = payload.orderId || payload.order_id
  if (!ownerId) return
  // Key milestones only: order placed + delivered.
  if (eventType === 'checkout.completed') {
    await insert({
      ownerId,
      type: 'order_placed',
      title: 'Order placed',
      body: `Your order ${orderId} has been placed. We'll let you know when it ships.`,
      metadata: payload,
    })
  } else if (eventType === 'order.delivered') {
    await insert({
      ownerId,
      type: 'order_delivered',
      title: 'Your package has arrived',
      body: `Order ${orderId} has been delivered. Enjoy!`,
      metadata: payload,
    })
  }
}

async function mapBillingToInbox (payload) {
  const eventType = payload.eventType || payload.event_type
  const ownerId = payload.ownerId || payload.owner_id
  const period = payload.period || ''
  const billNoun = (payload.display_name || 'Tax Bill').toLowerCase()
  if (!ownerId) return
  if (eventType === 'tax.bill_issued') {
    await insert({
      ownerId,
      type: 'tax_due',
      title: `${period} ${billNoun} issued`,
      body: `A new ${period} ${billNoun} is now due. View it under Pay bills.`,
      metadata: payload,
    })
  } else if (eventType === 'tax.payment_completed') {
    await insert({
      ownerId,
      type: 'tax_paid',
      title: 'Payment received',
      body: `Thank you — your ${period} ${billNoun} is paid.`,
      metadata: payload,
    })
  }
}

async function mapRequestToInbox (payload) {
  const eventType = payload.eventType || payload.event_type || ''
  const ownerId = payload.ownerId || payload.owner_id
  const status = (payload.status || payload.new_status || '').toLowerCase()
  const requestId = payload.requestId || payload.request_id || ''
  if (!ownerId) return
  // Key milestones only: request received (submitted) + resolved.
  if (status === 'submitted' || eventType.endsWith('.submitted')) {
    await insert({
      ownerId,
      type: 'request_received',
      title: 'Service request received',
      body: `We've received your request ${requestId} and will get it assigned.`,
      metadata: payload,
    })
  } else if (status === 'resolved' || eventType.endsWith('.resolved')) {
    await insert({
      ownerId,
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
      topics: ENABLED_TOPICS,
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
          if (topic === 'requests.events') {
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

    console.log(JSON.stringify({ level: 'info', msg: 'Kafka consumer started', topics: ENABLED_TOPICS }))
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

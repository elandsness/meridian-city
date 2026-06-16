'use strict'

/**
 * Store Purchase Journey
 *
 * Simulates a citizen buying merchandise end-to-end. Drives the City Store
 * Purchase funnel (Flow D):
 *   cart.item_added → checkout.completed → order.packed → order.shipped → order.delivered
 * (the later transitions fire on the commerce-service fulfillment timer).
 *
 * Steps:
 *   1. Register a citizen        (POST /api/v1/citizens)
 *   2. Browse products           (GET  /api/v1/store/products)
 *   3. Add 1-3 products to cart  (POST /api/v1/store/cart/items)
 *   4. View the cart             (GET  /api/v1/store/cart?citizen_id=:id)
 *   5. Buy now (checkout)        (POST /api/v1/store/checkout)
 *   6. View the order            (GET  /api/v1/store/orders/:id)
 */

const axios = require('axios')
const config = require('../config')
const data = require('../data')

const client = axios.create({
  baseURL: config.TARGET_URL,
  timeout: 15_000,
  validateStatus: (s) => s < 500,
})

async function run() {
  const reg = await client.post('/api/v1/citizens', data.generateCitizen())
  const citizenId = reg.data?.id
  if (!citizenId) throw new Error('no citizenId in citizen registration response')

  const prodRes = await client.get('/api/v1/store/products')
  const products = Array.isArray(prodRes.data) ? prodRes.data : prodRes.data?.items || []
  if (products.length === 0) throw new Error('no products available')

  const count = 1 + Math.floor(Math.random() * 3)
  for (let i = 0; i < count; i++) {
    const p = products[Math.floor(Math.random() * products.length)]
    await client.post('/api/v1/store/cart/items', {
      citizen_id: citizenId,
      product_id: p.id,
      quantity: 1,
    })
  }

  await client.get(`/api/v1/store/cart?citizen_id=${citizenId}`)

  const checkoutRes = await client.post('/api/v1/store/checkout', { citizen_id: citizenId })
  const orderId = checkoutRes.data?.id
  if (orderId) {
    await client.get(`/api/v1/store/orders/${orderId}`)
  }
}

module.exports = { run }

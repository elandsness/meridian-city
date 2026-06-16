import client from './client.js'

export function getProducts() {
  return client.get('/api/v1/store/products').then((r) => r.data)
}

export function getCart(citizenId) {
  return client.get('/api/v1/store/cart', { params: { citizen_id: citizenId } }).then((r) => r.data)
}

export function addToCart({ citizenId, productId, quantity = 1 }) {
  return client
    .post('/api/v1/store/cart/items', { citizen_id: citizenId, product_id: productId, quantity })
    .then((r) => r.data)
}

export function removeFromCart(citizenId, productId) {
  return client
    .delete(`/api/v1/store/cart/items/${productId}`, { params: { citizen_id: citizenId } })
    .then((r) => r.data)
}

export function checkout(citizenId) {
  return client.post('/api/v1/store/checkout', { citizen_id: citizenId }).then((r) => r.data)
}

export function getOrders(citizenId) {
  return client.get('/api/v1/store/orders', { params: { citizen_id: citizenId } }).then((r) => r.data)
}

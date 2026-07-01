import client from './client.js'

export function getFlights(params) {
  return client.get('/api/v1/flights', { params }).then((r) => r.data)
}

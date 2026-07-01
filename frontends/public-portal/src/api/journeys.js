import client from './client.js'

export function getPassengers(params) {
  return client.get('/api/v1/passengers', { params }).then((r) => r.data)
}

export function getPassenger(id) {
  return client.get(`/api/v1/passengers/${id}`).then((r) => r.data)
}

import client from './client.js'

export function getPassengers(params) {
  return client.get('/api/v1/passengers', { params }).then((r) => r.data)
}

export function getPassenger(id) {
  return client.get(`/api/v1/passengers/${id}`).then((r) => r.data)
}

// The logged-in user's own journey (created on first visit by passenger-service).
export function getMyJourney(userId, name) {
  return client.get('/api/v1/passengers/me', { params: { user_id: userId, name } }).then((r) => r.data)
}

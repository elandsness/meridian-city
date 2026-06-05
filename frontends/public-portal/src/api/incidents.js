import client from './client.js'

export function getIncidents(params) {
  return client.get('/api/v1/incidents', { params }).then((r) => r.data)
}

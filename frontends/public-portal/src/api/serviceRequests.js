import client from './client.js'

export function getServiceRequests(params) {
  return client.get('/api/v1/service-requests', { params }).then((r) => r.data)
}

export function createServiceRequest(data) {
  return client.post('/api/v1/service-requests', data).then((r) => r.data)
}

export function getServiceRequest(id) {
  return client.get(`/api/v1/service-requests/${id}`).then((r) => r.data)
}

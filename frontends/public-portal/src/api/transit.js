import client from './client.js'

export function getTransitLines() {
  return client.get('/api/v1/transit/lines').then((r) => r.data)
}

export function getTransitStatus() {
  return client.get('/api/v1/transit/status').then((r) => r.data)
}

import client from './client.js'

export function getDevices() {
  return client.get('/api/v1/devices').then((r) => r.data)
}

import client from './client.js'

export function getMessages(citizenId, { unreadOnly } = {}) {
  return client
    .get('/api/v1/messages', {
      params: { citizen_id: citizenId, unread_only: unreadOnly ? 'true' : undefined },
    })
    .then((r) => r.data)
}

export function markMessageRead(id) {
  return client.post(`/api/v1/messages/${id}/read`).then((r) => r.data)
}

export function markAllRead(citizenId) {
  return client
    .post('/api/v1/messages/read-all', null, { params: { citizen_id: citizenId } })
    .then((r) => r.data)
}

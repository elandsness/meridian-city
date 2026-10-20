import client from './client.js'

export function getMessages(ownerId, { unreadOnly } = {}) {
  return client
    .get('/api/v1/messages', {
      params: { owner_id: ownerId, unread_only: unreadOnly ? 'true' : undefined },
    })
    .then((r) => r.data)
}

export function markMessageRead(id) {
  return client.post(`/api/v1/messages/${id}/read`).then((r) => r.data)
}

export function markAllRead(ownerId) {
  return client
    .post('/api/v1/messages/read-all', null, { params: { owner_id: ownerId } })
    .then((r) => r.data)
}

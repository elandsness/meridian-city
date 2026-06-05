import client from './client.js'

export function sendMessage({ message, session_id, context }) {
  return client.post('/api/v1/chat', { message, session_id, context }).then((r) => r.data)
}

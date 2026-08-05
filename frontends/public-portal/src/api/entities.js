import client from './client.js'

export function getEntities(entityType, params) {
  return client.get(`/api/v1/entities/${entityType}`, { params }).then((r) => r.data)
}

export function getEntity(entityType, id) {
  return client.get(`/api/v1/entities/${entityType}/${id}`).then((r) => r.data)
}

export function runEntityAction(entityType, id, action) {
  return client.post(`/api/v1/entities/${entityType}/${id}/actions/${action}`).then((r) => r.data)
}

export function createEntity(entityType, fields) {
  return client.post(`/api/v1/entities/${entityType}`, fields).then((r) => r.data)
}

// Defensive unwrap (API_CONVENTIONS): entity-engine returns a plain array today,
// but a future wrapper envelope shouldn't blank the page.
export function unwrapEntities(d) {
  return Array.isArray(d) ? d : d?.entities ?? d?.items ?? []
}

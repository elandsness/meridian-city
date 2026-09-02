import client from './client.js';

export async function getEntities(entityType, params = {}) {
  const res = await client.get(`/api/v1/entities/${entityType}`, { params });
  return res.data;
}

export async function getEntity(entityType, id) {
  const res = await client.get(`/api/v1/entities/${entityType}/${id}`);
  return res.data;
}

export async function runEntityAction(entityType, id, action) {
  const res = await client.post(`/api/v1/entities/${entityType}/${id}/actions/${action}`);
  return res.data;
}

// Defensive unwrap (API_CONVENTIONS): entity-engine returns a plain array today,
// but a future wrapper envelope shouldn't blank the page.
export function unwrapEntities(d) {
  return Array.isArray(d) ? d : d?.entities ?? d?.items ?? [];
}

import client from './client.js';

export async function getIncidents(params = {}) {
  // Entity engine filters by `state`, not `status` — rename at the boundary.
  const mapped = { ...params };
  if ('status' in mapped) { mapped.state = mapped.status; delete mapped.status; }
  const res = await client.get('/api/v1/incidents', { params: mapped });
  return res.data;
}

export async function getIncident(id) {
  const res = await client.get(`/api/v1/incidents/${id}`);
  return res.data;
}

export async function getIncidentComments(id) {
  const res = await client.get(`/api/v1/incidents/${id}/comments`);
  return res.data;
}

export async function addIncidentComment(id, { author, body }) {
  const res = await client.post(`/api/v1/incidents/${id}/comments`, { author, body });
  return res.data;
}

// Entity engine exposes state transitions via the actions endpoint (no PATCH).
export async function updateIncidentStatus(id, status) {
  const res = await client.post(`/api/v1/incidents/${id}/actions/${status}`);
  return res.data;
}

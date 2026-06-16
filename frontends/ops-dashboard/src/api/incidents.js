import client from './client.js';

export async function getIncidents(params = {}) {
  const res = await client.get('/api/v1/incidents', { params });
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

// status is a single word, so casing is not an issue.
export async function updateIncidentStatus(id, status) {
  const res = await client.patch(`/api/v1/incidents/${id}`, { status });
  return res.data;
}

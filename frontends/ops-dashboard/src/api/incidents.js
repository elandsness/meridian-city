import client from './client.js';

export async function getIncidents(params = {}) {
  const res = await client.get('/api/v1/incidents', { params });
  return res.data;
}

export async function getIncident(id) {
  const res = await client.get(`/api/v1/incidents/${id}`);
  return res.data;
}

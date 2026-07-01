import client from './client.js';

export async function getFlights(params = {}) {
  const res = await client.get('/api/v1/flights', { params });
  return res.data;
}

export async function getFlight(id) {
  const res = await client.get(`/api/v1/flights/${id}`);
  return res.data;
}

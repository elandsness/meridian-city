import client from './client.js';

export async function getKpis() {
  const res = await client.get('/api/v1/kpis');
  return res.data;
}

export async function getKpiHistory(hours = 24) {
  const res = await client.get(`/api/v1/kpis/history?hours=${hours}`);
  // Backend wraps the array as { snapshots, count }; callers expect the array.
  return res.data?.snapshots ?? [];
}

export async function getFunnel(name) {
  const res = await client.get(`/api/v1/analytics/funnels/${name}`);
  return res.data;
}

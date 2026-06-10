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
  // Gateway forwards /api/v1/funnels/* verbatim to analytics-service
  // (GET /api/v1/funnels/{funnel_name}); the /api/v1/analytics prefix is not a
  // real upstream path. See docs/API_CONVENTIONS.md §5.
  const res = await client.get(`/api/v1/funnels/${name}`);
  return res.data;
}

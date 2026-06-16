import client from './client.js';

export async function getServiceRequests(params = {}) {
  const res = await client.get('/api/v1/service-requests', { params });
  return res.data;
}

// Advance a request's status. Body uses snake_case keys, but `status` is a single
// word so it's casing-agnostic; assigned_* are optional and omitted here.
export async function updateRequestStatus(id, status) {
  const res = await client.patch(`/api/v1/service-requests/${id}/status`, { status });
  return res.data;
}

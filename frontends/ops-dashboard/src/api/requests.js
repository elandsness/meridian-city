import client from './client.js';

export async function getServiceRequests(params = {}) {
  const res = await client.get('/api/v1/service-requests', { params });
  return res.data;
}

// Advance a request via the entity engine action endpoint.
// `status` values match entity state names (in_progress, resolved).
export async function updateRequestStatus(id, status) {
  const res = await client.post(`/api/v1/entities/service_request/${id}/actions/${status}`);
  return res.data;
}

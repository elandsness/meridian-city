import client from './client.js';

export async function getDemoStatus() {
  const res = await client.get('/api/v1/demo-control/status');
  return res.data;
}

export async function getScenarios() {
  const res = await client.get('/api/v1/demo-control/scenarios');
  return res.data;
}

export async function startScenario(id, params = {}) {
  const res = await client.post(`/api/v1/demo-control/scenarios/${id}/start`, params);
  return res.data;
}

export async function resetActiveScenario() {
  const res = await client.delete('/api/v1/demo-control/scenarios/active');
  return res.data;
}

export async function resetAll() {
  const res = await client.post('/api/v1/demo-control/scenarios/reset-all');
  return res.data;
}

export async function getFleetStatus() {
  const res = await client.get('/api/v1/demo-control/fleet/status');
  return res.data;
}

// Set one device type's population to an exact count (generic across whatever
// device types the industry config declares -- not a fixed vehicle/building/
// machine set).
export async function resizeFleetType(type, count) {
  const res = await client.post('/api/v1/demo-control/fleet/resize', { type, count });
  return res.data;
}

export async function getTrafficStatus() {
  const res = await client.get('/api/v1/demo-control/traffic/status');
  return res.data;
}

export async function startTraffic() {
  const res = await client.post('/api/v1/demo-control/traffic/start');
  return res.data;
}

export async function stopTraffic() {
  const res = await client.post('/api/v1/demo-control/traffic/stop');
  return res.data;
}

export async function burstTraffic(duration_minutes = 2) {
  const res = await client.post('/api/v1/demo-control/traffic/burst', { duration_minutes });
  return res.data;
}

// Enable/disable a single traffic-bot journey at runtime (e.g. 'chatbot' chat traffic).
export async function setJourneyEnabled(name, enabled) {
  const res = await client.post('/api/v1/demo-control/traffic/journey', { name, enabled });
  return res.data;
}

export async function purgeMessages() {
  await client.delete('/api/v1/messages');
}

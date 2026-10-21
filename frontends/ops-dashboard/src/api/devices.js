import client from './client.js';

export async function getDevices(type) {
  const res = await client.get('/api/v1/demo-control/iot/devices', { params: type ? { type } : undefined });
  return res.data;
}

export async function getDeviceTypes() {
  const res = await client.get('/api/v1/demo-control/iot/device-types');
  return res.data;
}

export async function getFaultGates() {
  const res = await client.get('/api/v1/demo-control/iot/fault-gates');
  return res.data;
}

export async function setFaultGate(type, body) {
  const res = await client.put(`/api/v1/demo-control/iot/fault-gates/${encodeURIComponent(type)}`, body);
  return res.data;
}

export async function clearFaultGate(type) {
  const res = await client.delete(`/api/v1/demo-control/iot/fault-gates/${encodeURIComponent(type)}`);
  return res.data;
}

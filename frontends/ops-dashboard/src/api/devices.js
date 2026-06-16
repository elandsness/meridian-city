import client from './client.js';

export async function getDevices() {
  const res = await client.get('/api/v1/devices');
  return res.data;
}

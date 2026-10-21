import client from './client.js';

export async function getCommandCenterStatus() {
  const res = await client.get('/api/v1/demo-control/command-center');
  return res.data;
}

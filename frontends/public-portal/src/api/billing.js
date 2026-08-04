import client from './client.js'

export function getBills(citizenId, status) {
  const params = {}
  if (citizenId) params.citizen_id = citizenId
  // entity engine uses `state` not `status`; map the legacy caller's param name
  if (status) params.state = status
  return client.get('/api/v1/entities/bill', { params }).then((r) => r.data)
}

export function payBill(billId) {
  return client.post(`/api/v1/entities/bill/${billId}/actions/pay`).then((r) => r.data)
}

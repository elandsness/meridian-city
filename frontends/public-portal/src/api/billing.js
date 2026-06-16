import client from './client.js'

export function getBills(citizenId, status) {
  return client
    .get('/api/v1/billing/bills', { params: { citizen_id: citizenId, status } })
    .then((r) => r.data)
}

export function payBill(billId) {
  return client.post(`/api/v1/billing/bills/${billId}/pay`).then((r) => r.data)
}

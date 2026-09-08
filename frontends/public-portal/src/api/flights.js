import client from './client.js'

// flight_departure/flight_arrival are separate entity types on the generic
// entity engine (see values-airport.yaml's comment on why -- different initial
// states and field sets), not one "flight" entity with a direction field. The
// old /api/v1/flights route pointed at a "flight-ops" service that was never
// part of the entity-engine migration and doesn't exist in the chart at all.
export function getFlightDepartures(params) {
  return client.get('/api/v1/entities/flight_departure', { params }).then((r) => r.data)
}

export function getFlightArrivals(params) {
  return client.get('/api/v1/entities/flight_arrival', { params }).then((r) => r.data)
}

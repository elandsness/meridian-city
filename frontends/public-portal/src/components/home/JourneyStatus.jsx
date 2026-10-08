import { useQuery } from '@tanstack/react-query'
import Card from '../../ui/Card.jsx'
import { getFlightDepartures, getFlightArrivals } from '../../api/flights.js'
import { ENTITY_SEMANTIC_MAP } from '../../config/semanticMap.js'

const STATUS_LABEL = {
  at_gate: 'At gate',
  boarding: 'Boarding',
  taxiing: 'Taxiing',
  takeoff: 'Departing',
  departed: 'Departed',
  approach: 'Approach',
  landing: 'Landing',
  taxi_in: 'Taxiing in',
  arrived: 'Arrived',
}

function badgeClass(status) {
  if (status === 'boarding') return 'bg-green-50 text-green-700'
  if (status === 'takeoff' || status === 'departed') return 'bg-slate-100 text-slate-600'
  if (status === 'approach' || status === 'landing' || status === 'taxi_in') return 'bg-amber-50 text-amber-700'
  return 'bg-blue-50 text-blue-700'
}

function unwrap(d) {
  return Array.isArray(d) ? d : d?.flights ?? d?.items ?? []
}

function Row({ f, type }) {
  const config = ENTITY_SEMANTIC_MAP[type] || ENTITY_SEMANTIC_MAP.default
  const displayId = f[config.idField] ?? '—'
  
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
      <div className="flex flex-col">
        <p className="text-sm font-medium text-slate-900">{displayId}</p>
        <p className="text-xs text-slate-500">
          {config.endpointPrefix} {f.destination || f.origin || '—'}
        </p>
      </div>
      <span className={`text-xs px-2 py-1 rounded ${badgeClass(f.status)}`}>
        {STATUS_LABEL[f.status] ?? f.status}
      </span>
    </div>
  )
}

export default function JourneyStatus() {
  const { data: departureData, isError: departuresError } = useQuery({
    queryKey: ['flights', 'flight_departure'],
    queryFn: () => getFlightDepartures(),
    refetchInterval: 10000,
  })
  const { data: arrivalData, isError: arrivalsError } = useQuery({
    queryKey: ['flights', 'flight_arrival'],
    queryFn: () => getFlightArrivals(),
    refetchInterval: 10000,
  })
  const departures = unwrap(departureData).filter((f) => f.status !== 'departed' && f.status !== 'cancelled').slice(0, 6)
  const arrivals = unwrap(arrivalData).filter((f) => f.status !== 'arrived' && f.status !== 'diverted').slice(0, 6)

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card title="Departures">
        {departuresError ? (
          <p className="text-slate-500 text-sm py-4 text-center">Flight status unavailable.</p>
        ) : departures.length === 0 ? (
          <p className="text-slate-500 text-sm py-4 text-center">No departures right now.</p>
        ) : (
          departures.map((f) => <Row key={f.id} f={f} type="flight_departure" />)
        )}
      </Card>
      <Card title="Arrivals">
        {arrivalsError ? (
          <p className="text-slate-500 text-sm py-4 text-center">Flight status unavailable.</p>
        ) : arrivals.length === 0 ? (
          <p className="text-slate-500 text-sm py-4 text-center">No arrivals right now.</p>
        ) : (
          arrivals.map((f) => <Row key={f.id} f={f} type="flight_arrival" />)
        )}
      </Card>
    </div>
  )
}

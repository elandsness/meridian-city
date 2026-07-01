import { useQuery } from '@tanstack/react-query'
import { useConfig } from '../config/ConfigContext'
import { getPassengers } from '../api/journeys.js'
import Card from '../ui/Card.jsx'

// Canonical journey order. Bag steps only apply when the passenger checked a bag.
const ORDER = ['checked_in', 'bag_checked', 'security_cleared', 'bag_loaded', 'boarded']
const STEPS = [
  { key: 'checked_in', label: 'Checked in' },
  { key: 'bag_checked', label: 'Bag checked', bagOnly: true },
  { key: 'security_cleared', label: 'Security' },
  { key: 'bag_loaded', label: 'Bag loaded', bagOnly: true },
  { key: 'boarded', label: 'Boarded' },
]

function unwrapArray(d) {
  return Array.isArray(d) ? d : d?.items ?? d?.passengers ?? []
}

function JourneyStepper({ status, hasBag }) {
  const steps = STEPS.filter((s) => !s.bagOnly || hasBag)
  const currentIdx = ORDER.indexOf(status)
  return (
    <div className="mt-3 flex items-center">
      {steps.map((s, i) => {
        const idx = ORDER.indexOf(s.key)
        const done = currentIdx >= idx
        const current = status === s.key
        return (
          <div key={s.key} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div
                className={`w-3 h-3 rounded-full transition-colors ${
                  done ? 'bg-meridian-blue' : 'bg-slate-200'
                } ${current ? 'ring-4 ring-meridian-blue/20' : ''}`}
              />
              <span
                className={`mt-1 text-[10px] leading-tight text-center ${
                  done ? 'text-slate-700 font-medium' : 'text-slate-400'
                }`}
              >
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`h-0.5 flex-1 mx-1 mb-4 ${currentIdx > idx ? 'bg-meridian-blue' : 'bg-slate-200'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function MyJourney() {
  const cfg = useConfig()
  const { data, isLoading, isError } = useQuery({
    queryKey: ['passengers'],
    queryFn: () => getPassengers(),
    refetchInterval: 10_000,
  })
  const passengers = unwrapArray(data)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Journey</h1>
        <p className="text-slate-500 text-sm mt-1">
          Live passenger journeys through {cfg.company.name}, gate to gate.
        </p>
      </div>

      {isLoading && <p className="text-slate-500">Loading…</p>}

      {isError && (
        <p className="text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          Failed to load journeys.
        </p>
      )}

      {!isLoading && !isError && passengers.length === 0 && (
        <Card>
          <div className="text-center py-8">
            <p className="text-slate-500">No journeys in progress right now.</p>
          </div>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {passengers.map((p) => (
          <Card key={p.id}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-slate-900">{p.name ?? 'Passenger'}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {p.flight_number ? `Flight ${p.flight_number}` : 'Flight TBD'}
                  {p.seat ? ` · Seat ${p.seat}` : ''}
                  {p.gate ? ` · Gate ${p.gate}` : ''}
                </p>
              </div>
              <span className="text-xs text-slate-400 whitespace-nowrap">
                {p.has_bag ? '🧳 Checked bag' : '🎒 Carry-on'}
              </span>
            </div>
            <JourneyStepper status={p.status} hasBag={p.has_bag} />
          </Card>
        ))}
      </div>
    </div>
  )
}

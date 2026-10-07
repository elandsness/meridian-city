import { useQuery } from '@tanstack/react-query'
import { useConfig } from '../config/ConfigContext'
import { useAuth } from '../context/AuthContext.jsx'
import { displayName } from '../lib/format.js'
import { getPassengers, getMyJourney } from '../api/journeys.js'
import Card from '../ui/Card.jsx'
import Button from '../ui/Button.jsx'

function unwrapArray(d) {
  return Array.isArray(d) ? d : d?.items ?? d?.passengers ?? []
}

function JourneyStepper({ status, hasBag, entityConfig }) {
  if (!entityConfig || !entityConfig.sequence) {
    return <div className="text-xs text-red-500">Journey configuration missing</div>
  }

  const sequence = entityConfig.sequence
  const statesCfg = entityConfig.states || {}
  const currentIdx = sequence.indexOf(status)

  return (
    <div className="flex items-center">
      {sequence.map((stateKey, i) => {
        const stateCfg = statesCfg[stateKey] || {}
        const done = currentIdx >= i
        const current = status === stateKey
        
        // Match original logic: skip 'bag' states if no bag
        const isBagOnly = stateKey.includes('bag')
        if (isBagOnly && !hasBag) return null

        return (
          <div key={stateKey} className="flex items-center flex-1 last:flex-none">
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
                {stateCfg.label ?? stateKey}
              </span>
            </div>
            {i < sequence.length - 1 && (
              <div className={`h-0.5 flex-1 mx-1 mb-4 ${currentIdx > i ? 'bg-meridian-blue' : 'bg-slate-200'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function PassengerCard({ p, entityConfig }) {
  return (
    <Card>
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
          {p.has_bag ? '<0xF0><0x9F><0xA7><0xB3> Checked bag' : '🎒 Carry-on'}
        </span>
      </div>
      <div className="mt-3">
        <JourneyStepper status={p.status} hasBag={p.has_bag} entityConfig={entityConfig} />
      </div>
    </Card>
  )
}

function MyOwnJourney({ userId, name, cfg }) {
  const passengerCfg = cfg.entities?.passenger
  const { data: p, isLoading, isError } = useQuery({
    queryKey: ['my-journey', userId],
    queryFn: () => getMyJourney(userId, name),
    refetchInterval: 8000,
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Journey</h1>
        <p className="text-slate-500 text-sm mt-1">Your trip through {cfg.company.name}, tracked step by step.</p>
      </div>

      {isLoading && <p className="text-slate-500">Loading your journey…</p>}
      {isError && (
        <p className="text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">Couldn't load your journey.</p>
      )}

      {p && (
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-lg font-semibold text-slate-900">{p.name}</p>
              <p className="text-sm text-slate-500 mt-0.5">
                {p.flight_number ? `Flight ${p.flight_number}` : 'Flight to be assigned'}
                {p.gate ? ` · Gate ${p.gate}` : ''}
                {p.seat ? ` · Seat ${p.seat}` : ''}
              </p>
            </div>
            <span className="text-xs text-slate-500 whitespace-nowrap">
              {p.has_bag ? '<0xF0><0x9F><0xA7><0xB3> Checked bag' : '🎒 Carry-on only'}
            </span>
          </div>
          <div className="mt-5">
            <JourneyStepper status={p.status} hasBag={p.has_bag} entityConfig={passengerCfg} />
          </div>
          <p className="mt-5 text-sm text-slate-600">
            {p.status === 'boarded'
              ? 'You are all boarded — have a great flight! ✈️'
              : `Current step: ${passengerCfg?.states?.[p.status]?.label ?? p.status}.`}
          </p>
        </Card>
      )}
    </div>
  )
}

function LiveBoard({ cfg, isAuthenticated }) {
  const passengerCfg = cfg.entities?.passenger
  const { data, isLoading, isError } = useQuery({
    queryKey: ['passengers'],
    queryFn: () => getPassengers(),
    refetchInterval: 10_000,
  })
  const passengers = unwrapArray(data)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Journeys</h1>
          <p className="text-slate-500 text-sm mt-1">
            Live passenger journeys through {cfg.company.name}, gate to gate.
          </p>
        </div>
        {!isAuthenticated && (
          <Button to="/login" variant="primary" size="sm">Log in to track your journey</Button>
        )}
      </div>

      {isLoading && <p className="text-slate-500">Loading…</p>}
      {isError && (
        <p className="text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">Failed to load journeys.</p>
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
          <PassengerCard key={p.id} p={p} entityConfig={passengerCfg} />
        ))}
      </div>
    </div>
  )
}

export default function MyJourney() {
  const cfg = useConfig()
  const { isAuthenticated, user } = useAuth()
  const myId = user?.id

  if (!myId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
        <p className="text-slate-500">Please log in to view your journey.</p>
      </div>
    )
  }

  return <MyOwnJourney userId={myId} name={displayName(user)} cfg={cfg} />
}

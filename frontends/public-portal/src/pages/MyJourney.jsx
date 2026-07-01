import { useQuery } from '@tanstack/react-query'
import { useConfig } from '../config/ConfigContext'
import { useAuth } from '../context/AuthContext.jsx'
import { displayName } from '../lib/format.js'
import { getPassengers, getMyJourney } from '../api/journeys.js'
import Card from '../ui/Card.jsx'
import Button from '../ui/Button.jsx'

const ORDER = ['checked_in', 'bag_checked', 'security_cleared', 'bag_loaded', 'boarded']
const STEPS = [
  { key: 'checked_in', label: 'Checked in' },
  { key: 'bag_checked', label: 'Bag checked', bagOnly: true },
  { key: 'security_cleared', label: 'Security' },
  { key: 'bag_loaded', label: 'Bag loaded', bagOnly: true },
  { key: 'boarded', label: 'Boarded' },
]
const STEP_LABEL = {
  checked_in: 'Checked in',
  bag_checked: 'Bag checked',
  security_cleared: 'Security cleared',
  bag_loaded: 'Bag loaded',
  boarded: 'Boarded',
}

function unwrapArray(d) {
  return Array.isArray(d) ? d : d?.items ?? d?.passengers ?? []
}

function JourneyStepper({ status, hasBag }) {
  const steps = STEPS.filter((s) => !s.bagOnly || hasBag)
  const currentIdx = ORDER.indexOf(status)
  return (
    <div className="flex items-center">
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

function PassengerCard({ p }) {
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
          {p.has_bag ? '🧳 Checked bag' : '🎒 Carry-on'}
        </span>
      </div>
      <div className="mt-3">
        <JourneyStepper status={p.status} hasBag={p.has_bag} />
      </div>
    </Card>
  )
}

// Signed-in passenger: their own journey, created on first visit and progressing live.
function MyOwnJourney({ userId, name, cfg }) {
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
              {p.has_bag ? '🧳 Checked bag' : '🎒 Carry-on only'}
            </span>
          </div>
          <div className="mt-5">
            <JourneyStepper status={p.status} hasBag={p.has_bag} />
          </div>
          <p className="mt-5 text-sm text-slate-600">
            {p.status === 'boarded'
              ? 'You are all boarded — have a great flight! ✈️'
              : `Current step: ${STEP_LABEL[p.status] ?? p.status}.`}
          </p>
        </Card>
      )}
    </div>
  )
}

// Operator / logged-out: the live board of journeys across the airport.
function LiveBoard({ cfg, isAuthenticated }) {
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
          <PassengerCard key={p.id} p={p} />
        ))}
      </div>
    </div>
  )
}

export default function MyJourney() {
  const cfg = useConfig()
  const { isAuthenticated, user } = useAuth()
  const myId = user?.id
  // A logged-in passenger has an identity (user.id); the demo operator does not.
  if (myId) return <MyOwnJourney userId={myId} name={displayName(user)} cfg={cfg} />
  return <LiveBoard cfg={cfg} isAuthenticated={isAuthenticated} />
}

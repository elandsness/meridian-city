import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getFlights } from '../../api/flights.js'
import { useConfig } from '../../config/ConfigContext'

// Passenger-facing airfield map (same schematic + client-tick glide as the ops view).
// Aircraft flow vertically in a stable per-flight lane: gates (bottom) <-> taxiway <->
// runway (top). Position derives from flight status, interpolated by time-since-updated_at.
const VW = 1000
const VH = 620
const SEG_MS = 55_000

const DEP_STATES = ['at_gate', 'servicing', 'boarding', 'taxiing', 'takeoff', 'departed']
const ARR_STATES = ['approach', 'landing', 'taxi_in', 'arrived']
const TERMINAL_STATES = new Set(['departed', 'arrived', 'cancelled'])

const Y_GATE = 468
const Y_TAXI = 300
const Y_RUNWAY = 132
const Y_SKY = 54

const PLANE_PATH =
  'M0,-10 L2,-4 L2,-2 L10,3 L10,5 L2,3 L2,7 L4,9 L4,10 L0,9 L-4,10 L-4,9 L-2,7 L-2,3 L-10,5 L-10,3 L-2,-2 L-2,-4 Z'

function depNode(state, laneX) {
  switch (state) {
    case 'taxiing':
      return { x: laneX, y: Y_TAXI }
    case 'takeoff':
      return { x: laneX + 40, y: Y_RUNWAY }
    case 'departed':
      return { x: 930, y: Y_SKY }
    default:
      return { x: laneX, y: Y_GATE }
  }
}

function arrNode(state, laneX) {
  switch (state) {
    case 'approach':
      return { x: 70, y: Y_SKY }
    case 'landing':
      return { x: laneX - 40, y: Y_RUNWAY }
    case 'taxi_in':
      return { x: laneX, y: Y_TAXI }
    default:
      return { x: laneX, y: Y_GATE }
  }
}

function hashInt(s) {
  let h = 0
  const str = s ?? ''
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0
  return Math.abs(h)
}

function laneFor(id) {
  return 120 + (hashInt(id) % 760)
}

function lerp(a, b, t) {
  return a + (b - a) * t
}

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}

function planePose(flight) {
  const isDep = flight.direction === 'departure'
  const states = isDep ? DEP_STATES : ARR_STATES
  const nodeFn = isDep ? depNode : arrNode
  const laneX = laneFor(flight.id)
  const idx = Math.max(0, states.indexOf(flight.status))
  const cur = nodeFn(states[idx], laneX)
  const isLast = idx >= states.length - 1
  const nxt = isLast ? cur : nodeFn(states[idx + 1], laneX)

  const startedMs = Date.parse(flight.updated_at) || Date.now()
  const frac = isLast ? 0 : easeInOut(Math.min(1, Math.max(0, (Date.now() - startedMs) / SEG_MS)))
  const x = lerp(cur.x, nxt.x, frac)
  const y = lerp(cur.y, nxt.y, frac)

  const dx = nxt.x - cur.x
  const dy = nxt.y - cur.y
  let angle
  if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) angle = isDep ? 0 : 180
  else angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90

  return { x, y, angle, isDep }
}

function Plane({ flight }) {
  const { x, y, angle, isDep } = planePose(flight)
  const color = isDep ? '#22d3ee' : '#fbbf24'
  return (
    <g transform={`translate(${x} ${y})`}>
      <g transform={`rotate(${angle}) scale(1.3)`}>
        <path d={PLANE_PATH} fill={color} stroke="#0b1220" strokeWidth="0.6" />
      </g>
      <text x="0" y="-17" fill="#cbd5e1" fontSize="10" textAnchor="middle">
        {flight.flight_number}
      </text>
    </g>
  )
}

function Airfield({ terminalName }) {
  return (
    <g>
      <rect x="60" y={Y_RUNWAY - 22} width="880" height="44" rx="4" fill="#1f2937" stroke="#374151" />
      <line x1="82" y1={Y_RUNWAY} x2="918" y2={Y_RUNWAY} stroke="#4b5563" strokeWidth="2" strokeDasharray="20 16" />
      <text x="72" y={Y_RUNWAY + 5} fill="#6b7280" fontSize="13" fontWeight="bold">27</text>
      <text x="912" y={Y_RUNWAY + 5} fill="#6b7280" fontSize="13" fontWeight="bold" textAnchor="end">09</text>
      <line x1="100" y1={Y_TAXI} x2="900" y2={Y_TAXI} stroke="#facc15" strokeOpacity="0.22" strokeWidth="6" />
      <text x="104" y={Y_TAXI - 12} fill="#475569" fontSize="11" letterSpacing="1">TAXIWAY A</text>
      <rect x="120" y={Y_GATE + 26} width="760" height="118" rx="10" fill="#111827" stroke="#374151" />
      <text x="500" y={Y_GATE + 96} fill="#334155" fontSize="22" fontWeight="bold" textAnchor="middle" letterSpacing="6">
        {(terminalName || 'AIRFIELD').toUpperCase()}
      </text>
      {Array.from({ length: 12 }).map((_, i) => {
        const gx = 168 + i * 60
        return <rect key={i} x={gx - 6} y={Y_GATE + 14} width="12" height="10" fill="#1f2937" stroke="#374151" />
      })}
    </g>
  )
}

export default function AirfieldMapCard() {
  const cfg = useConfig()
  const { data } = useQuery({
    queryKey: ['flights'],
    queryFn: () => getFlights(),
    refetchInterval: 8000,
  })

  const [, setTick] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => (t + 1) % 100000), 200)
    return () => clearInterval(timer)
  }, [])

  const flights = Array.isArray(data) ? data : data?.flights ?? data?.items ?? []
  const active = flights.filter((f) => !TERMINAL_STATES.has(f.status))

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-medium text-slate-900">Airfield</h2>
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-cyan-400" /> Departures</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Arrivals</span>
        </div>
      </div>
      <div className="rounded-2xl overflow-hidden border border-slate-200">
        <svg viewBox={`0 0 ${VW} ${VH}`} className="w-full" style={{ background: '#0b1220' }}>
          <Airfield terminalName={cfg?.company?.name} />
          {active.map((f) => (
            <Plane key={f.id} flight={f} />
          ))}
        </svg>
      </div>
    </div>
  )
}

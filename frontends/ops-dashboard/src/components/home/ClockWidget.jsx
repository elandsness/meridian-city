import { useState, useEffect } from 'react'
import Card from '../../ui/Card.jsx'

const DEFAULT_TIMEZONES = [{ tz: 'local', label: 'Local Time' }]

function formatTime(tz) {
  const opts = {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }
  if (tz === 'local') return new Date().toLocaleTimeString('en-US', opts)
  return new Date().toLocaleTimeString('en-US', { ...opts, timeZone: tz })
}

function formatDate(tz) {
  const opts = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }
  if (tz === 'local') return new Date().toLocaleDateString('en-US', opts)
  return new Date().toLocaleDateString('en-US', { ...opts, timeZone: tz })
}

function ClockFace({ tz, label }) {
  const [time, setTime] = useState(() => ({ t: formatTime(tz), d: formatDate(tz) }))

  useEffect(() => {
    const id = setInterval(() => setTime({ t: formatTime(tz), d: formatDate(tz) }), 1000)
    return () => clearInterval(id)
  }, [tz])

  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="text-2xl font-mono font-semibold text-slate-900 tabular-nums">{time.t}</div>
      <div className="text-xs text-slate-500">{time.d}</div>
      {label && <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mt-0.5">{label}</div>}
    </div>
  )
}

export default function ClockWidget({ timezones }) {
  const zones = timezones ?? DEFAULT_TIMEZONES
  const title = zones.length === 1 ? zones[0].label : 'Time'

  return (
    <Card title={title}>
      <div className={`grid gap-4 ${zones.length > 1 ? 'grid-cols-2' : ''}`}>
        {zones.slice(0, 4).map((z) => (
          <ClockFace key={z.tz} tz={z.tz} label={zones.length > 1 ? z.label : null} />
        ))}
      </div>
    </Card>
  )
}

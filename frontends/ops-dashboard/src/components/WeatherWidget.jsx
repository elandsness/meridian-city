// WeatherWidget — configurable weather display for the ops dashboard.
// Reads location and temperature units from props or falls back to config.
// Used by the PageComposer / component registry pattern for reskinning.

import { useConfig } from '../config/ConfigContext'

function SunFace() {
  const rays = Array.from({ length: 12 }, (_, i) => {
    const a = (i * 30 * Math.PI) / 180
    return {
      x1: 50 + Math.cos(a) * 30,
      y1: 50 + Math.sin(a) * 30,
      x2: 50 + Math.cos(a) * 40,
      y2: 50 + Math.sin(a) * 40,
    }
  })
  return (
    <svg viewBox="0 0 100 100" width="60" height="60" className="flex-none drop-shadow-sm" role="img" aria-label="Sunny">
      <g fill="none" stroke="#FBBF24" strokeWidth="6" strokeLinecap="round">
        {rays.map((r, i) => (
          <line key={i} x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2} />
        ))}
        <animateTransform attributeName="transform" type="rotate" from="0 50 50" to="360 50 50" dur="24s" repeatCount="indefinite" />
      </g>
      <circle cx="50" cy="50" r="24" fill="#FCD34D" />
      <g fill="#1f2937">
        <rect x="32" y="42" width="15" height="12" rx="4" />
        <rect x="53" y="42" width="15" height="12" rx="4" />
        <rect x="46" y="45" width="8" height="3" rx="1.5" />
      </g>
      <g fill="#ffffff" opacity="0.35">
        <rect x="34.5" y="44" width="4" height="3" rx="1.5" />
        <rect x="55.5" y="44" width="4" height="3" rx="1.5" />
      </g>
      <path d="M40 60 Q50 70 60 60" fill="none" stroke="#1f2937" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

function celsiusToFahrenheit(c) {
  return Math.round(c * 9) / 5 + 32
}

export default function WeatherWidget({ location, units = 'fahrenheit', config }) {
  const cfg = useConfig()
  const locationName = location || cfg.company?.name || 'Meridian City'
  const displayUnits = units === 'celsius' ? 'celsius' : 'fahrenheit'

  const highC = 24
  const lowC = 22
  const condition = 'Sunny'

  const high = displayUnits === 'celsius' ? highC : celsiusToFahrenheit(highC)
  const low = displayUnits === 'celsius' ? lowC : celsiusToFahrenheit(lowC)

  return (
    <div className="relative overflow-hidden rounded-xl px-4 py-3 text-white bg-gradient-to-br from-sky-400 to-blue-500">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs font-medium text-white/90 truncate">{locationName}</div>
          <div className="text-3xl font-semibold leading-tight">{high}&deg;</div>
          <div className="text-sm text-white/90">{condition}</div>
        </div>
        <SunFace />
      </div>
      <div className="mt-1 text-[11px] text-white/80">
        H:{high}&deg;&nbsp;&nbsp;L:{low}&deg;&nbsp;&nbsp;&middot;&nbsp;&nbsp;Perfect, as always
      </div>
    </div>
  )
}

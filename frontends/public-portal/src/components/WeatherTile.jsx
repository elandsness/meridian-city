// Always-perfect-weather tile for the portal home page. Purely decorative and
// intentionally fake — Meridian City is permanently 75° and sunny. Styled like a
// phone weather widget, fronted by a smiling sun in sunglasses. Replaces the old
// "Open incidents" stat tile.

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
      {/* Rays — slowly rotating around the sun's center. */}
      <g fill="none" stroke="#FBBF24" strokeWidth="6" strokeLinecap="round">
        {rays.map((r, i) => (
          <line key={i} x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2} />
        ))}
        <animateTransform attributeName="transform" type="rotate" from="0 50 50" to="360 50 50" dur="24s" repeatCount="indefinite" />
      </g>
      {/* Sun body */}
      <circle cx="50" cy="50" r="24" fill="#FCD34D" />
      {/* Sunglasses */}
      <g fill="#1f2937">
        <rect x="32" y="42" width="15" height="12" rx="4" />
        <rect x="53" y="42" width="15" height="12" rx="4" />
        <rect x="46" y="45" width="8" height="3" rx="1.5" />
      </g>
      {/* Lens shine */}
      <g fill="#ffffff" opacity="0.35">
        <rect x="34.5" y="44" width="4" height="3" rx="1.5" />
        <rect x="55.5" y="44" width="4" height="3" rx="1.5" />
      </g>
      {/* Smile */}
      <path d="M40 60 Q50 70 60 60" fill="none" stroke="#1f2937" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

export default function WeatherTile() {
  return (
    <div className="relative overflow-hidden rounded-xl px-4 py-3 text-white bg-gradient-to-br from-sky-400 to-blue-500">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs font-medium text-white/90 truncate">Meridian City</div>
          <div className="text-3xl font-semibold leading-tight">75°</div>
          <div className="text-sm text-white/90">Sunny</div>
        </div>
        <SunFace />
      </div>
      <div className="mt-1 text-[11px] text-white/80">H:75°&nbsp;&nbsp;L:75°&nbsp;&nbsp;·&nbsp;&nbsp;Perfect, as always</div>
    </div>
  )
}

import { useQuery } from '@tanstack/react-query'
import { getTransitLines, getTransitStatus } from '../api/transit.js'

const STROKE_WIDTH = { rail: 6, subway: 4, bus: 3 }

/**
 * Schematic transit map (no basemap). Topology — lines, stops, coordinates, colors —
 * comes from demo-control-api; vehicle positions + per-line status are polled and
 * rendered as a moving dot that lights up the stop it's currently at.
 */
export default function TransitMap() {
  const { data: linesData } = useQuery({
    queryKey: ['transit', 'lines'],
    queryFn: getTransitLines,
    staleTime: Infinity,
  })
  const { data: statusData } = useQuery({
    queryKey: ['transit', 'status'],
    queryFn: getTransitStatus,
    refetchInterval: 4000,
  })

  const lines = Array.isArray(linesData?.lines) ? linesData.lines : []
  const vehicles = Array.isArray(statusData?.lines) ? statusData.lines : []

  // Dedup stops by id (interchanges appear on multiple lines); track which line
  // colors touch each stop so multi-line interchanges render neutral.
  const stopById = {}
  const stopColors = {}
  for (const line of lines) {
    for (const s of line.stops) {
      stopById[s.id] = s
      if (!stopColors[s.id]) stopColors[s.id] = new Set()
      stopColors[s.id].add(line.color)
    }
  }
  const colorByLine = Object.fromEntries(lines.map((l) => [l.id, l.color]))

  return (
    <svg viewBox="0 0 680 420" className="w-full h-auto" role="img" aria-label="Meridian City transit map">
      {lines.map((line) => (
        <polyline
          key={line.id}
          points={line.stops.map((s) => `${s.x},${s.y}`).join(' ')}
          fill="none"
          stroke={line.color}
          strokeWidth={STROKE_WIDTH[line.mode] || 4}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={line.mode === 'bus' ? '7 5' : undefined}
        />
      ))}

      {Object.values(stopById).map((s) => {
        const colors = [...stopColors[s.id]]
        const hub = colors.length > 1
        return (
          <g key={s.id}>
            <circle cx={s.x} cy={s.y} r={hub ? 8 : 5} fill="#ffffff" stroke={hub ? '#475569' : colors[0]} strokeWidth={2} />
            {hub && <circle cx={s.x} cy={s.y} r={3} fill="#475569" />}
            {s.label && (
              <text
                x={s.x + s.label.dx}
                y={s.y + s.label.dy}
                textAnchor={s.label.anchor}
                style={{ fontSize: '11px', fill: '#64748b' }}
              >
                {s.name}
              </text>
            )}
          </g>
        )
      })}

      {vehicles.map((v) => {
        const stop = stopById[v.current_stop_id]
        if (!stop) return null
        const color = colorByLine[v.line_id] || '#475569'
        return (
          <g
            key={v.line_id}
            style={{ transform: `translate(${stop.x}px, ${stop.y}px)`, transition: 'transform 1.2s ease-in-out' }}
          >
            <circle r={10} fill="none" stroke={color} strokeWidth={2} opacity={0.5}>
              <animate attributeName="opacity" values="0.55;0.12;0.55" dur="2s" repeatCount="indefinite" />
            </circle>
            <circle r={5} fill={color} stroke="#ffffff" strokeWidth={2} />
          </g>
        )
      })}
    </svg>
  )
}

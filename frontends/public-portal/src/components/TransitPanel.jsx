import { useQuery } from '@tanstack/react-query'
import { getTransitLines, getTransitStatus } from '../api/transit.js'
import Badge from '../ui/Badge.jsx'

const STROKE_WIDTH = { rail: 6, subway: 4, bus: 3 }
const MODE_LABEL = { rail: 'Regional rail', subway: 'Subway', bus: 'Bus' }

// Topology + live status share one cadence: the backend advances vehicles once a
// minute, so there's nothing to gain from polling faster.
const STATUS_REFETCH_MS = 60000

function statusFor(v) {
  if (!v) return { text: '—', tone: 'slate' }
  if (v.status === 'late') return { text: `${v.delay_minutes} min late`, tone: 'amber' }
  if (v.status === 'early') return { text: `${v.delay_minutes} min early`, tone: 'blue' }
  return { text: 'On time', tone: 'green' }
}

/**
 * Smooth SVG path through a list of {x,y} points using a Catmull-Rom spline
 * converted to cubic Béziers. Colinear points yield straight segments, bends
 * yield gentle curves — so routes read like a real transit diagram instead of
 * connect-the-dots polylines.
 */
function smoothPath(points) {
  if (points.length < 2) return ''
  if (points.length === 2) {
    return `M ${points[0].x},${points[0].y} L ${points[1].x},${points[1].y}`
  }
  const d = [`M ${points[0].x},${points[0].y}`]
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1]
    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6
    d.push(`C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`)
  }
  return d.join(' ')
}

/**
 * Combined transit panel for the portal home page — a curved schematic map with
 * an inline live-status legend below it. Topology (lines, stops, coordinates,
 * colors) comes from demo-control-api; vehicle positions + per-line status are
 * polled and rendered as a moving dot that lights up the stop it's currently at.
 */
export default function TransitPanel() {
  const { data: linesData } = useQuery({
    queryKey: ['transit', 'lines'],
    queryFn: getTransitLines,
    staleTime: Infinity,
  })
  const { data: statusData } = useQuery({
    queryKey: ['transit', 'status'],
    queryFn: getTransitStatus,
    refetchInterval: STATUS_REFETCH_MS,
  })

  const lines = Array.isArray(linesData?.lines) ? linesData.lines : []
  const vehicles = Array.isArray(statusData?.lines) ? statusData.lines : []

  if (lines.length === 0) {
    return <p className="text-slate-400 text-sm py-8 text-center">Loading transit…</p>
  }

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
    <div className="space-y-4">
      <div className="rounded-xl bg-slate-50 border border-slate-100 p-2">
        <svg viewBox="0 0 720 470" className="w-full h-auto" role="img" aria-label="Meridian City transit map">
          {lines.map((line) => (
            <path
              key={line.id}
              d={smoothPath(line.stops)}
              fill="none"
              stroke={line.color}
              strokeWidth={STROKE_WIDTH[line.mode] || 4}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={line.mode === 'bus' ? '7 6' : undefined}
              opacity={line.mode === 'bus' ? 0.85 : 1}
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
                    style={{ fontSize: '10px', fontWeight: 500, fill: '#475569' }}
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
                style={{ transform: `translate(${stop.x}px, ${stop.y}px)`, transition: 'transform 1.6s ease-in-out' }}
              >
                <circle r={10} fill="none" stroke={color} strokeWidth={2} opacity={0.5}>
                  <animate attributeName="opacity" values="0.55;0.12;0.55" dur="2.4s" repeatCount="indefinite" />
                </circle>
                <circle r={5} fill={color} stroke="#ffffff" strokeWidth={2} />
              </g>
            )
          })}
        </svg>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0.5">
        {lines.map((line) => {
          const st = statusFor(vehicles.find((x) => x.line_id === line.id))
          return (
            <div
              key={line.id}
              className="flex items-center justify-between gap-3 py-2 border-b border-slate-100"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-3 h-3 rounded-full flex-none" style={{ backgroundColor: line.color }} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{line.name}</p>
                  <p className="text-xs text-slate-500">{MODE_LABEL[line.mode] || line.mode}</p>
                </div>
              </div>
              <Badge tone={st.tone}>{st.text}</Badge>
            </div>
          )
        })}
      </div>
    </div>
  )
}

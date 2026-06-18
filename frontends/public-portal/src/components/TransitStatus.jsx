import { useQuery } from '@tanstack/react-query'
import { getTransitLines, getTransitStatus } from '../api/transit.js'
import Badge from '../ui/Badge.jsx'

const MODE_LABEL = { rail: 'Regional rail', subway: 'Subway', bus: 'Bus' }

function statusFor(v) {
  if (!v) return { text: '—', tone: 'slate' }
  if (v.status === 'late') return { text: `${v.delay_minutes} min late`, tone: 'amber' }
  if (v.status === 'early') return { text: `${v.delay_minutes} min early`, tone: 'blue' }
  return { text: 'On time', tone: 'green' }
}

/**
 * Live transit-status panel — one row per line with a status badge. Replaces the old
 * "Live incidents" panel on the portal home page.
 */
export default function TransitStatus() {
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

  if (lines.length === 0) {
    return <p className="text-slate-400 text-sm py-4 text-center">Loading transit status…</p>
  }

  return (
    <div className="-my-1">
      {lines.map((line) => {
        const st = statusFor(vehicles.find((x) => x.line_id === line.id))
        return (
          <div
            key={line.id}
            className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0"
          >
            <div className="flex items-center gap-3 min-w-0">
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
  )
}

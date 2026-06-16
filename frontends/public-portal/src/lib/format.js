// Small presentation helpers shared across the portal.

export function timeAgo(ts) {
  if (!ts) return ''
  const then = new Date(ts).getTime()
  if (Number.isNaN(then)) return ''
  const secs = Math.max(0, Math.round((Date.now() - then) / 1000))
  if (secs < 60) return 'just now'
  const mins = Math.round(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.round(hrs / 24)
  return `${days}d ago`
}

// First name for the greeting; falls back gracefully (citizen `username` is an email).
export function displayName(user) {
  if (!user) return 'neighbor'
  const n = user.name || user.first_name || user.username || ''
  return n.split(' ')[0] || n || 'neighbor'
}

export function greeting(d = new Date()) {
  const h = d.getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

const SEVERITY = {
  critical: { tone: 'red', dot: 'bg-red-500', label: 'Critical' },
  high: { tone: 'orange', dot: 'bg-orange-500', label: 'High' },
  medium: { tone: 'amber', dot: 'bg-amber-500', label: 'Medium' },
  low: { tone: 'slate', dot: 'bg-slate-400', label: 'Low' },
}

export function severityMeta(sev) {
  return (
    SEVERITY[(sev || '').toLowerCase()] || { tone: 'slate', dot: 'bg-slate-400', label: sev || 'Unknown' }
  )
}

const SEV_RANK = { critical: 4, high: 3, medium: 2, low: 1 }
export function severityRank(sev) {
  return SEV_RANK[(sev || '').toLowerCase()] || 0
}

const REQUEST_STATUS = {
  submitted: { tone: 'blue', label: 'Submitted' },
  dispatched: { tone: 'blue', label: 'Dispatched' },
  assigned: { tone: 'amber', label: 'Assigned' },
  acknowledged: { tone: 'amber', label: 'Acknowledged' },
  in_progress: { tone: 'amber', label: 'In progress' },
  resolved: { tone: 'green', label: 'Resolved' },
  cancelled: { tone: 'slate', label: 'Cancelled' },
  closed: { tone: 'slate', label: 'Closed' },
}

export function requestStatusMeta(status) {
  const key = (status || '').toLowerCase()
  return REQUEST_STATUS[key] || { tone: 'slate', label: (status || 'unknown').replace(/_/g, ' ') }
}

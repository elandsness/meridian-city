import { useQuery } from '@tanstack/react-query'
import { useParams, Link } from 'react-router-dom'
import { getServiceRequest } from '../api/serviceRequests.js'
import Card from '../ui/Card.jsx'
import Badge from '../ui/Badge.jsx'
import Timeline from '../ui/Timeline.jsx'
import { requestStatusMeta } from '../lib/format.js'

const STAGES = [
  ['submitted', 'Submitted'],
  ['dispatched', 'Dispatched to department'],
  ['assigned', 'Assigned to a crew'],
  ['in_progress', 'Work in progress'],
  ['resolved', 'Resolved'],
]

// Map the current status onto the lifecycle stages (acknowledged ~ assigned).
function buildSteps(status) {
  const s = (status || '').toLowerCase()
  let current = STAGES.findIndex(([key]) => key === s)
  if (s === 'acknowledged') current = 2
  if (current < 0) current = 0
  const resolved = s === 'resolved'
  return STAGES.map(([, label], i) => ({
    label,
    state: i < current || (resolved && i === current) ? 'done' : i === current ? 'current' : 'pending',
  }))
}

function formatDate(ts) {
  if (!ts) return '—'
  try {
    return new Date(ts).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return ts
  }
}

export default function RequestDetail() {
  const { id } = useParams()
  const { data, isLoading, isError } = useQuery({
    queryKey: ['serviceRequest', id],
    queryFn: () => getServiceRequest(id),
    refetchInterval: 30000,
  })

  const req = data && !Array.isArray(data) ? data : null
  const meta = requestStatusMeta(req?.status)
  const cancelled = (req?.status || '').toLowerCase() === 'cancelled'

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/service-requests" className="text-slate-500 hover:text-slate-900 transition-colors text-sm">
          ← Back to requests
        </Link>
      </div>

      {isLoading && <p className="text-slate-500">Loading…</p>}
      {isError && (
        <p className="text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          Couldn't load this request.
        </p>
      )}

      {req && (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{req.title}</h1>
              <p className="text-sm text-slate-500 mt-1 font-mono">{req.id}</p>
            </div>
            <Badge tone={meta.tone}>{meta.label}</Badge>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2" title="Details">
              {req.description && <p className="text-sm text-slate-700 whitespace-pre-line">{req.description}</p>}
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 mt-4 text-sm">
                <div>
                  <dt className="text-slate-500">Category</dt>
                  <dd className="text-slate-900 capitalize">{req.category || '—'}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Priority</dt>
                  <dd className="text-slate-900 capitalize">{req.priority || '—'}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Submitted</dt>
                  <dd className="text-slate-900">{formatDate(req.created_at ?? req.createdAt)}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Last updated</dt>
                  <dd className="text-slate-900">{formatDate(req.updated_at ?? req.updatedAt)}</dd>
                </div>
              </dl>
            </Card>

            <Card title="Status">
              {cancelled ? (
                <p className="text-sm text-slate-500">This request was cancelled.</p>
              ) : (
                <Timeline steps={buildSteps(req.status)} />
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

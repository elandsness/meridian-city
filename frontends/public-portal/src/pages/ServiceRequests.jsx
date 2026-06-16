import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext.jsx'
import { getServiceRequests } from '../api/serviceRequests.js'
import Card from '../ui/Card.jsx'
import Button from '../ui/Button.jsx'
import Badge from '../ui/Badge.jsx'
import { requestStatusMeta } from '../lib/format.js'

function StatusBadge({ status }) {
  const meta = requestStatusMeta(status)
  return <Badge tone={meta.tone}>{meta.label}</Badge>
}

function formatDate(ts) {
  if (!ts) return '—'
  try {
    return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return ts
  }
}

function truncateId(id) {
  if (!id) return '—'
  return String(id).slice(0, 8) + (String(id).length > 8 ? '…' : '')
}

export default function ServiceRequests() {
  const { user } = useAuth()

  const params = { page: 1, limit: 20 }
  if (user?.id) params.citizen_id = user.id

  const { data, isLoading, isError } = useQuery({
    queryKey: ['serviceRequests', params],
    queryFn: () => getServiceRequests(params),
  })

  const requests = Array.isArray(data) ? data : data?.requests || data?.items || data?.data || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Service requests</h1>
          <p className="text-slate-500 text-sm mt-1">Track the issues you've reported to the city.</p>
        </div>
        <Button to="/service-requests/new" variant="primary">Submit new request</Button>
      </div>

      {isLoading && <p className="text-slate-500">Loading…</p>}

      {isError && (
        <p className="text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          Failed to load service requests.
        </p>
      )}

      {!isLoading && !isError && requests.length === 0 && (
        <Card>
          <div className="text-center py-8">
            <p className="text-slate-500">You have no service requests yet.</p>
            <div className="mt-4 flex justify-center">
              <Button to="/service-requests/new" variant="primary" size="sm">Submit your first request</Button>
            </div>
          </div>
        </Card>
      )}

      {!isLoading && requests.length > 0 && (
        <Card bodyClassName="!p-0">
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 text-left">
                  <th className="px-4 py-3 font-medium">ID</th>
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Priority</th>
                  <th className="px-4 py-3 font-medium">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((req, i) => (
                  <tr key={req.id || i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-slate-400 text-xs">{truncateId(req.id)}</td>
                    <td className="px-4 py-3 text-slate-900 max-w-xs truncate">{req.title}</td>
                    <td className="px-4 py-3 text-slate-600 capitalize">{req.category}</td>
                    <td className="px-4 py-3"><StatusBadge status={req.status} /></td>
                    <td className="px-4 py-3 text-slate-600 capitalize">{req.priority}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(req.created_at ?? req.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-slate-100">
            {requests.map((req, i) => (
              <div key={req.id || i} className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-slate-900">{req.title}</p>
                  <StatusBadge status={req.status} />
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                  <span className="capitalize">{req.category}</span>
                  <span>·</span>
                  <span className="capitalize">{req.priority}</span>
                  <span>·</span>
                  <span>{formatDate(req.created_at ?? req.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

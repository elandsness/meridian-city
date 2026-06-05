import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { getServiceRequests } from '../api/serviceRequests.js'

const STATUS_COLORS = {
  submitted: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  in_progress: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  resolved: 'bg-green-500/20 text-green-400 border border-green-500/30',
  cancelled: 'bg-slate-500/20 text-slate-400 border border-slate-500/30',
}

function StatusBadge({ status }) {
  const cls = STATUS_COLORS[status] || STATUS_COLORS.cancelled
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>
      {status?.replace('_', ' ') || 'unknown'}
    </span>
  )
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

  const requests = Array.isArray(data) ? data : data?.requests || data?.data || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Service Requests</h1>
        <Link
          to="/service-requests/new"
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          + Submit New Request
        </Link>
      </div>

      {isLoading && (
        <p className="text-slate-400">Loading...</p>
      )}

      {isError && (
        <p className="text-red-400 bg-red-900/20 border border-red-800 rounded-xl px-4 py-3">
          Failed to load service requests.
        </p>
      )}

      {!isLoading && !isError && requests.length === 0 && (
        <div className="bg-slate-800 rounded-xl p-10 text-center">
          <p className="text-slate-400">You have no service requests yet.</p>
          <Link
            to="/service-requests/new"
            className="inline-block mt-4 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Submit your first request
          </Link>
        </div>
      )}

      {!isLoading && requests.length > 0 && (
        <div className="bg-slate-800 rounded-xl overflow-hidden">
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400 text-left">
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
                  <tr
                    key={req.id || i}
                    className="border-b border-slate-700 last:border-0 hover:bg-slate-700/50 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-slate-400 text-xs">
                      {truncateId(req.id)}
                    </td>
                    <td className="px-4 py-3 text-white max-w-xs truncate">{req.title}</td>
                    <td className="px-4 py-3 text-slate-300 capitalize">{req.category}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={req.status} />
                    </td>
                    <td className="px-4 py-3 text-slate-300 capitalize">{req.priority}</td>
                    <td className="px-4 py-3 text-slate-400">{formatDate(req.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-slate-700">
            {requests.map((req, i) => (
              <div key={req.id || i} className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-white">{req.title}</p>
                  <StatusBadge status={req.status} />
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-slate-400">
                  <span className="capitalize">{req.category}</span>
                  <span>·</span>
                  <span className="capitalize">{req.priority}</span>
                  <span>·</span>
                  <span>{formatDate(req.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import IncidentBadge from '../components/IncidentBadge.jsx';
import { getIncidents } from '../api/incidents.js';

const PAGE_SIZE = 10;

function formatDate(ts) {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

export default function IncidentsPage() {
  const [filter, setFilter] = useState('open'); // 'open' | 'all'
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState(null);

  const params = { limit: 100 };
  if (filter === 'open') params.status = 'open';

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['incidents', filter],
    queryFn: () => getIncidents(params),
    refetchInterval: 30_000,
  });

  const incidents = Array.isArray(data) ? data : data?.incidents ?? [];
  const totalPages = Math.max(1, Math.ceil(incidents.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageItems = incidents.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  function toggleExpand(id) {
    setExpanded((prev) => (prev === id ? null : id));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Incidents</h1>
        <button
          onClick={() => refetch()}
          className="text-xs text-gray-500 hover:text-cyan-400 transition-colors"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {['open', 'all'].map((f) => (
          <button
            key={f}
            onClick={() => { setFilter(f); setPage(0); setExpanded(null); }}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors capitalize ${
              filter === f
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {error && (
        <p className="text-rose-400 text-sm">Failed to load incidents: {error.message}</p>
      )}

      {/* Table */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wide">
              <th className="px-4 py-3 text-left">ID</th>
              <th className="px-4 py-3 text-left">Severity</th>
              <th className="px-4 py-3 text-left">Title</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  Loading…
                </td>
              </tr>
            ) : pageItems.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  No incidents found
                </td>
              </tr>
            ) : (
              pageItems.map((incident) => (
                <React.Fragment key={incident.id ?? incident._id}>
                  <tr
                    className="hover:bg-gray-800/50 cursor-pointer transition-colors"
                    onClick={() => toggleExpand(incident.id ?? incident._id)}
                  >
                    <td className="px-4 py-3 font-mono text-gray-400 text-xs">
                      {String(incident.id ?? incident._id ?? '').slice(0, 8)}
                    </td>
                    <td className="px-4 py-3">
                      <IncidentBadge severity={incident.severity} />
                    </td>
                    <td className="px-4 py-3 text-white max-w-xs truncate">
                      {incident.title ?? incident.name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-400 capitalize">
                      {incident.status ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {formatDate(incident.created_at ?? incident.createdAt)}
                    </td>
                  </tr>
                  {expanded === (incident.id ?? incident._id) && (
                    <tr>
                      <td colSpan={5} className="px-4 py-4 bg-gray-800/60">
                        <div className="space-y-2 text-sm">
                          <p className="text-gray-300">
                            <span className="text-gray-500">Description: </span>
                            {incident.description ?? 'No description available.'}
                          </p>
                          {incident.work_order_count != null && (
                            <p className="text-gray-300">
                              <span className="text-gray-500">Work Orders: </span>
                              {incident.work_order_count}
                            </p>
                          )}
                          {incident.service && (
                            <p className="text-gray-300">
                              <span className="text-gray-500">Service: </span>
                              {incident.service}
                            </p>
                          )}
                          {incident.resolved_at && (
                            <p className="text-gray-300">
                              <span className="text-gray-500">Resolved: </span>
                              {formatDate(incident.resolved_at)}
                            </p>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>
            Page {safePage + 1} of {totalPages} ({incidents.length} total)
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
              className="px-3 py-1 rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              ← Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={safePage >= totalPages - 1}
              className="px-3 py-1 rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

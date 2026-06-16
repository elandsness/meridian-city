import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getServiceRequests, updateRequestStatus } from '../api/requests.js';

const STATUS = {
  submitted: 'bg-blue-500/20 text-blue-300',
  dispatched: 'bg-blue-500/20 text-blue-300',
  assigned: 'bg-amber-500/20 text-amber-300',
  acknowledged: 'bg-amber-500/20 text-amber-300',
  in_progress: 'bg-amber-500/20 text-amber-300',
  resolved: 'bg-green-500/20 text-green-300',
  cancelled: 'bg-gray-500/20 text-gray-300',
};

const CLOSED = new Set(['resolved', 'cancelled']);

function StatusBadge({ status }) {
  const cls = STATUS[(status || '').toLowerCase()] || STATUS.cancelled;
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>
      {(status || 'unknown').replace(/_/g, ' ')}
    </span>
  );
}

function formatDate(ts) {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return ts;
  }
}

export default function RequestQueue() {
  const queryClient = useQueryClient();
  const [openOnly, setOpenOnly] = useState(true);
  const [pendingId, setPendingId] = useState(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['ops-requests'],
    queryFn: () => getServiceRequests({ limit: 100 }),
    refetchInterval: 20000,
  });

  const mutation = useMutation({
    mutationFn: ({ id, status }) => updateRequestStatus(id, status),
    onMutate: ({ id }) => setPendingId(id),
    onSettled: () => {
      setPendingId(null);
      queryClient.invalidateQueries({ queryKey: ['ops-requests'] });
    },
  });

  const all = Array.isArray(data) ? data : data?.requests || data?.items || [];
  const requests = openOnly ? all.filter((r) => !CLOSED.has((r.status || '').toLowerCase())) : all;

  function advance(id, status) {
    mutation.mutate({ id, status });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Service Requests</h1>
          <p className="text-sm text-gray-500 mt-1">Respond to issues reported by residents.</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-400">
          <input type="checkbox" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} />
          Open only
        </label>
      </div>

      {isLoading && <p className="text-gray-400">Loading…</p>}
      {isError && (
        <p className="text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-lg px-4 py-3">
          Failed to load service requests.
        </p>
      )}

      {!isLoading && !isError && requests.length === 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-10 text-center text-gray-400">
          No {openOnly ? 'open ' : ''}requests right now.
        </div>
      )}

      {requests.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-500 text-left">
                <th className="px-4 py-3 font-medium">ID</th>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Priority</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Submitted</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((req, i) => {
                const status = (req.status || '').toLowerCase();
                const open = !CLOSED.has(status);
                const busy = pendingId === req.id;
                return (
                  <tr key={req.id || i} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/50">
                    <td className="px-4 py-3 font-mono text-gray-500 text-xs">{req.id}</td>
                    <td className="px-4 py-3 text-white max-w-xs truncate">{req.title}</td>
                    <td className="px-4 py-3 text-gray-300 capitalize">{req.category}</td>
                    <td className="px-4 py-3 text-gray-300 capitalize">{req.priority}</td>
                    <td className="px-4 py-3"><StatusBadge status={req.status} /></td>
                    <td className="px-4 py-3 text-gray-400">{formatDate(req.created_at ?? req.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {open && status !== 'in_progress' && (
                          <button
                            onClick={() => advance(req.id, 'in_progress')}
                            disabled={busy}
                            className="text-xs px-2.5 py-1 rounded border border-gray-700 text-gray-300 hover:bg-gray-700 disabled:opacity-50"
                          >
                            {busy ? '…' : 'Start'}
                          </button>
                        )}
                        {open && (
                          <button
                            onClick={() => advance(req.id, 'resolved')}
                            disabled={busy}
                            className="text-xs px-2.5 py-1 rounded bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 disabled:opacity-50"
                          >
                            {busy ? '…' : 'Resolve'}
                          </button>
                        )}
                        {!open && <span className="text-xs text-gray-600">—</span>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import IncidentBadge from '../components/IncidentBadge.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import {
  getIncident,
  getIncidentComments,
  addIncidentComment,
  updateIncidentStatus,
} from '../api/incidents.js';

function formatDate(ts) {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

export default function IncidentDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [comment, setComment] = useState('');

  const incidentQuery = useQuery({
    queryKey: ['incident', id],
    queryFn: () => getIncident(id),
    refetchInterval: 30_000,
  });
  const commentsQuery = useQuery({
    queryKey: ['incident', id, 'comments'],
    queryFn: () => getIncidentComments(id),
    refetchInterval: 30_000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['incident', id] });
    queryClient.invalidateQueries({ queryKey: ['incidents'] });
  };

  const statusMutation = useMutation({
    mutationFn: (status) => updateIncidentStatus(id, status),
    onSettled: invalidate,
  });

  const commentMutation = useMutation({
    mutationFn: (body) => addIncidentComment(id, { author: user?.username || 'operator', body }),
    onSuccess: () => {
      setComment('');
      invalidate();
    },
  });

  const incident = incidentQuery.data && !Array.isArray(incidentQuery.data) ? incidentQuery.data : null;
  const comments = Array.isArray(commentsQuery.data)
    ? commentsQuery.data
    : commentsQuery.data?.items ?? [];
  const resolved = (incident?.status || '').toLowerCase() === 'resolved';

  function submitComment(e) {
    e.preventDefault();
    const body = comment.trim();
    if (body && !commentMutation.isPending) commentMutation.mutate(body);
  }

  return (
    <div className="max-w-4xl space-y-6">
      <Link to="/incidents" className="text-sm text-gray-500 hover:text-cyan-400 transition-colors">
        ← Back to incidents
      </Link>

      {incidentQuery.isLoading && <p className="text-gray-400">Loading…</p>}
      {incidentQuery.isError && <p className="text-rose-400">Couldn't load this incident.</p>}

      {incident && (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-white">{incident.title}</h1>
                <IncidentBadge severity={incident.severity} />
              </div>
              <p className="text-sm text-gray-500 mt-1 font-mono">{incident.id}</p>
            </div>
            <div className="flex gap-2">
              {resolved ? (
                <button
                  onClick={() => statusMutation.mutate('open')}
                  disabled={statusMutation.isPending}
                  className="text-sm px-3 py-1.5 rounded border border-gray-700 text-gray-300 hover:bg-gray-700 disabled:opacity-50"
                >
                  Reopen
                </button>
              ) : (
                <button
                  onClick={() => statusMutation.mutate('resolved')}
                  disabled={statusMutation.isPending}
                  className="text-sm px-3 py-1.5 rounded bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 disabled:opacity-50"
                >
                  {statusMutation.isPending ? 'Saving…' : 'Resolve incident'}
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <h2 className="text-sm font-semibold text-gray-400 mb-3">Details</h2>
                <p className="text-sm text-gray-200 whitespace-pre-line">
                  {incident.description || 'No description provided.'}
                </p>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 mt-4 text-sm">
                  <div><dt className="text-gray-500">Status</dt><dd className="text-gray-200 capitalize">{incident.status}</dd></div>
                  <div><dt className="text-gray-500">Asset</dt><dd className="text-gray-200">{incident.asset_id || '—'}</dd></div>
                  <div><dt className="text-gray-500">Location</dt><dd className="text-gray-200">{incident.location_name || '—'}</dd></div>
                  <div><dt className="text-gray-500">Work orders</dt><dd className="text-gray-200">{incident.work_order_count ?? 0}</dd></div>
                  <div><dt className="text-gray-500">Created</dt><dd className="text-gray-200">{formatDate(incident.created_at)}</dd></div>
                  <div><dt className="text-gray-500">Resolved</dt><dd className="text-gray-200">{formatDate(incident.resolved_at)}</dd></div>
                </dl>
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <h2 className="text-sm font-semibold text-gray-400 mb-3">
                  Comments {comments.length > 0 && <span className="text-gray-600">({comments.length})</span>}
                </h2>
                <div className="space-y-3">
                  {comments.length === 0 && <p className="text-sm text-gray-500">No comments yet.</p>}
                  {comments.map((c) => (
                    <div key={c.id} className="border-b border-gray-800 last:border-0 pb-3 last:pb-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-white">{c.author || 'operator'}</span>
                        <span className="text-xs text-gray-600">{formatDate(c.created_at)}</span>
                      </div>
                      <p className="text-sm text-gray-300 mt-1 whitespace-pre-line">{c.body}</p>
                    </div>
                  ))}
                </div>

                <form onSubmit={submitComment} className="mt-4 flex flex-col gap-2">
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={2}
                    placeholder="Add a comment…"
                    className="bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-cyan-500 resize-none"
                  />
                  <button
                    type="submit"
                    disabled={!comment.trim() || commentMutation.isPending}
                    className="self-end text-sm px-3 py-1.5 rounded bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 disabled:opacity-50"
                  >
                    {commentMutation.isPending ? 'Posting…' : 'Comment'}
                  </button>
                </form>
              </div>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 h-fit">
              <h2 className="text-sm font-semibold text-gray-400 mb-3">Source</h2>
              <dl className="space-y-3 text-sm">
                <div><dt className="text-gray-500">Origin</dt><dd className="text-gray-200 capitalize">{incident.source || 'manual'}</dd></div>
                <div><dt className="text-gray-500">Severity</dt><dd className="text-gray-200 capitalize">{incident.severity || '—'}</dd></div>
              </dl>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

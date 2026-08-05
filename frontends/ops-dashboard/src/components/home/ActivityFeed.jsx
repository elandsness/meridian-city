import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useConfig } from '../../config/ConfigContext';
import { getEntities, unwrapEntities } from '../../api/entities.js';

function relativeTime(ts) {
  if (!ts) return '';
  const diffMs = Date.now() - new Date(ts).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  return `${diffHr}h ago`;
}

const STATE_TONE = {
  // common terminal / alert states
  cancelled: 'bg-rose-500/20 text-rose-400',
  diverted:  'bg-rose-500/20 text-rose-400',
  failed:    'bg-rose-500/20 text-rose-400',
  alert:     'bg-rose-500/20 text-rose-400',
  warning:   'bg-amber-500/20 text-amber-300',
  active:    'bg-cyan-500/20 text-cyan-400',
  resolved:  'bg-green-500/20 text-green-400',
  complete:  'bg-green-500/20 text-green-400',
  completed: 'bg-green-500/20 text-green-400',
};

function stateBadgeClass(state) {
  return STATE_TONE[state] ?? 'bg-gray-700 text-gray-400';
}

// ActivityFeed: polls all specified entity types (or all from config) every 5s
// and shows the most recently updated entities sorted by updated_at descending.
// Props:
//   entityTypes  string[]?   subset of entity types; omit for all from config
//   maxItems     number?     max rows to show (default 10)
export default function ActivityFeed({ entityTypes, maxItems = 10 }) {
  const cfg = useConfig();

  const types = useMemo(() => {
    if (Array.isArray(entityTypes) && entityTypes.length > 0) return entityTypes;
    return Object.keys(cfg.entities ?? {});
  }, [entityTypes, cfg.entities]);

  const results = useQueries({
    queries: types.map((et) => ({
      queryKey: ['entities', et],
      queryFn: () => getEntities(et),
      refetchInterval: 5_000,
    })),
  });

  const items = useMemo(() => {
    const all = [];
    results.forEach((res, i) => {
      const et = types[i];
      const entities = unwrapEntities(res.data);
      entities.forEach((e) => {
        const ts = e.updated_at ?? e.created_at ?? null;
        if (ts) {
          all.push({
            entityType: et,
            id: e.id ?? e.entity_id,
            state: e.state ?? e.status ?? '—',
            updatedAt: ts,
          });
        }
      });
    });
    return all
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .slice(0, maxItems);
  }, [results, types, maxItems]);

  const anyLoading = results.some((r) => r.isLoading);

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800">
      {/* Header */}
      <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Activity Feed</h2>
        <span className="flex items-center gap-1.5 text-xs text-rose-400">
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
          Live
        </span>
      </div>

      {/* Body */}
      <div className="divide-y divide-gray-800 max-h-80 overflow-y-auto">
        {anyLoading && items.length === 0 ? (
          <p className="px-5 py-6 text-gray-500 text-sm">Loading…</p>
        ) : items.length === 0 ? (
          <p className="px-5 py-6 text-gray-500 text-sm">No recent activity.</p>
        ) : (
          items.map((item, idx) => (
            <div key={idx} className="px-5 py-3 flex items-center gap-3">
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${stateBadgeClass(item.state)}`}
              >
                {item.state}
              </span>
              <span className="text-sm text-gray-300 flex-1 truncate">
                <span className="text-gray-500">{item.entityType}</span>
                <span className="text-gray-600 mx-1">#</span>
                <span className="font-mono text-gray-400 text-xs">{item.id}</span>
                <span className="text-gray-500 mx-1">→</span>
                {item.state}
              </span>
              <span className="text-xs text-gray-600 flex-shrink-0">{relativeTime(item.updatedAt)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

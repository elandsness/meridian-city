import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useConfig } from '../../config/ConfigContext.jsx';
import { getEntity, runEntityAction } from '../../api/entities.js';
import { getEntityDef, getStateOrder } from './entityConfig.js';

// Generic `entity-detail` screen template: header + field grid + a timeline
// built directly from the entity type's ordered `states` + optional
// transition action buttons.
//
// `entityType` is optional: falls back to the `:entityType` URL param so this
// same component also serves the one generic detail route
// (/entities/:entityType/:id, registered once in App.jsx) that every
// entity-list row links to -- no per-industry detail-screen config needed.
export default function EntityDetailPage({ entityType: entityTypeProp, fields }) {
  const { id, entityType: entityTypeParam } = useParams();
  const entityType = entityTypeProp ?? entityTypeParam;
  const config = useConfig();
  const queryClient = useQueryClient();
  const def = getEntityDef(config, entityType);

  const { data: entity, isLoading, isError } = useQuery({
    queryKey: ['entity', entityType, id],
    queryFn: () => getEntity(entityType, id),
    refetchInterval: 8000,
  });

  const actionMutation = useMutation({
    mutationFn: (action) => runEntityAction(entityType, id, action),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['entity', entityType, id] }),
  });

  if (isLoading) return <p className="text-sm text-gray-500 py-6 text-center">Loading…</p>;
  if (isError || !entity) return <p className="text-sm text-gray-500 py-6 text-center">Not found.</p>;

  const order = getStateOrder(def);
  const currentIndex = order.indexOf(entity.state);
  const steps = order
    .filter((s) => !def.states[s]?.isError || s === entity.state)
    .map((s) => ({
      label: def.states[s]?.label ?? s,
      status: order.indexOf(s) < currentIndex ? 'done' : order.indexOf(s) === currentIndex ? 'current' : 'pending',
    }));

  const columns = fields && fields.length > 0 ? fields : Object.keys(def?.fields ?? {});
  const actions = (def?.transitions ?? []).filter((t) => t.userTriggerable && t.from === entity.state);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 md:col-span-2">
        <h2 className="text-lg font-semibold text-white mb-4">{def?.displayName ?? entityType}</h2>
        <dl className="grid grid-cols-2 gap-4">
          {columns.map((c) => (
            <div key={c}>
              <dt className="text-xs text-gray-500 uppercase tracking-wide">{c.replace(/_/g, ' ')}</dt>
              <dd className="text-sm text-gray-200 mt-0.5">{formatValue(entity[c])}</dd>
            </div>
          ))}
        </dl>
        {actions.length > 0 && (
          <div className="flex gap-2 mt-6 pt-4 border-t border-gray-800">
            {actions.map((a) => (
              <button
                key={a.to}
                onClick={() => actionMutation.mutate(a.to)}
                disabled={actionMutation.isPending}
                className="text-sm px-3 py-1.5 rounded-lg bg-cyan-600 text-white disabled:opacity-50"
              >
                {a.label ?? a.to}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
        <h2 className="text-lg font-semibold text-white mb-4">Timeline</h2>
        <ol className="relative">
          {steps.map((s, i) => {
            const last = i === steps.length - 1;
            const dot =
              s.status === 'done' ? 'bg-cyan-500 border-cyan-500' :
              s.status === 'current' ? 'bg-amber-400 border-amber-400' :
              'bg-gray-800 border-gray-700';
            return (
              <li key={i} className="flex gap-3 pb-5 last:pb-0 relative">
                {!last && <span className="absolute left-[7px] top-4 bottom-0 w-px bg-gray-800" aria-hidden="true" />}
                <span className={`mt-0.5 w-4 h-4 rounded-full border-2 flex-none ${dot}`} />
                <p className={`text-sm ${s.status === 'pending' ? 'text-gray-600' : 'text-gray-200'}`}>{s.label}</p>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

function formatValue(v) {
  if (v == null) return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  return String(v);
}

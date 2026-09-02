import { useQuery } from '@tanstack/react-query';
import { useConfig } from '../../config/ConfigContext.jsx';
import { getEntities, unwrapEntities } from '../../api/entities.js';
import { getEntityDef, getStateOrder } from './entityConfig.js';
import Card from '../../ui/Card.jsx';

// Generic, decoratable journey tracker template for the ops-dashboard.
// Shows all entities of the given type as a live board with journey progress.
//
// Config shape (inside screens.ops):
//   { id, template: 'entity-journey', entityType, label?,
//     steps?, icon?, description? }
//
// steps: optional explicit ordered list of state keys to show as journey steps.
//   If omitted, all non-error states in declaration order are used.
export default function EntityJourneyPage({ entityType, label, steps: stepsProp, description }) {
  const cfg = useConfig();
  const def = getEntityDef(cfg, entityType);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['entity-journey-board', entityType],
    queryFn: () => getEntities(entityType),
    refetchInterval: 10_000,
  });
  const entities = unwrapEntities(data);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{label ?? def?.displayNamePlural ?? 'Journeys'}</h1>
        <p className="text-slate-500 text-sm mt-1">{description ?? `Live ${def?.displayName ?? entityType} journey board.`}</p>
      </div>

      {isLoading && <p className="text-slate-500 text-sm">Loading…</p>}
      {isError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">Failed to load journeys.</p>}

      {!isLoading && !isError && entities.length === 0 && (
        <Card>
          <div className="text-center py-8">
            <p className="text-slate-400">No active journeys right now.</p>
          </div>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {entities.map((e) => (
          <EntityJourneyCard key={e.id} entity={e} def={def} stepsProp={stepsProp} label={label} />
        ))}
      </div>
    </div>
  );
}

// Normalize steps to [{state, label}] regardless of whether the caller passed
// strings ("state_key") or objects ({state, label}) — schema allows both forms.
function resolveSteps(def, stepsProp) {
  const order = stepsProp ?? getStateOrder(def);
  return order
    .map((s) => (typeof s === 'string' ? { state: s } : s))
    .filter(({ state }) => !def?.states?.[state]?.isError);
}

function JourneyStepper({ entity, def, stepsProp }) {
  const steps = resolveSteps(def, stepsProp);
  const currentIdx = steps.findIndex(({ state }) => state === entity?.state);
  return (
    <div className="overflow-x-auto">
      <div className="flex items-start min-w-max">
        {steps.map(({ state, label: stepLabel }, i) => {
          const stateMeta = def?.states?.[state] ?? {};
          const done = currentIdx >= i;
          const current = entity?.state === state;
          const isLast = i === steps.length - 1;
          const displayLabel = stepLabel ?? stateMeta.label ?? state.replace(/_/g, ' ');
          return (
            <div key={state} className="flex items-center">
              <div className="flex flex-col items-center w-20">
                <div
                  className={`w-4 h-4 rounded-full border-2 transition-colors ${
                    done
                      ? 'bg-[rgb(var(--brand))] border-[rgb(var(--brand))]'
                      : 'bg-white border-slate-300'
                  } ${current ? 'ring-4 ring-[rgb(var(--brand))]/20 scale-125' : ''}`}
                />
                <span className={`mt-1.5 text-[10px] leading-tight text-center px-1 ${done ? 'text-slate-700 font-medium' : 'text-slate-400'}`}>
                  {displayLabel}
                </span>
              </div>
              {!isLast && (
                <div className={`h-0.5 w-6 mb-5 ${currentIdx > i ? 'bg-[rgb(var(--brand))]' : 'bg-slate-200'}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EntityJourneyCard({ entity, def, stepsProp, label }) {
  const displayId = entity.id?.slice(-6) ?? entity.id;
  const stateMeta = def?.states?.[entity.state] ?? {};
  const toneClass = {
    slate: 'bg-slate-100 text-slate-600',
    blue: 'bg-blue-50 text-blue-700',
    amber: 'bg-amber-50 text-amber-700',
    orange: 'bg-orange-50 text-orange-700',
    green: 'bg-green-50 text-green-700',
    red: 'bg-red-50 text-red-700',
  }[stateMeta.tone] ?? 'bg-slate-100 text-slate-600';

  return (
    <Card>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <p className="font-semibold text-slate-900">{def?.displayName ?? label} #{displayId}</p>
          <p className="text-xs text-slate-400 mt-0.5">
            {entity.created_at ? new Date(entity.created_at).toLocaleString() : ''}
          </p>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${toneClass}`}>
          {stateMeta.label ?? entity.state}
        </span>
      </div>
      <JourneyStepper entity={entity} def={def} stepsProp={stepsProp} />
    </Card>
  );
}

import { useQuery } from '@tanstack/react-query';
import { useConfig } from '../../config/ConfigContext';
import { getEntities, unwrapEntities } from '../../api/entities.js';

// State tone -> Tailwind color pair for the breakdown strip.
const TONE_COLORS = {
  green:  { bar: 'bg-green-500',  text: 'text-green-400' },
  amber:  { bar: 'bg-amber-500',  text: 'text-amber-400' },
  orange: { bar: 'bg-orange-500', text: 'text-orange-400' },
  red:    { bar: 'bg-red-500',    text: 'text-red-400' },
  blue:   { bar: 'bg-blue-500',   text: 'text-blue-400' },
  cyan:   { bar: 'bg-cyan-500',   text: 'text-cyan-400' },
  slate:  { bar: 'bg-slate-500',  text: 'text-slate-400' },
};

function EntityTile({ entityType }) {
  const cfg = useConfig();
  const def = cfg.entities?.[entityType];

  const { data, isLoading, isError } = useQuery({
    queryKey: ['entities', entityType],
    queryFn: () => getEntities(entityType),
    refetchInterval: 15_000,
  });

  const entities = unwrapEntities(data);

  const stateCounts = entities.reduce((acc, e) => {
    const s = e.state ?? e.status ?? 'unknown';
    acc[s] = (acc[s] ?? 0) + 1;
    return acc;
  }, {});

  const kpiStates = Object.entries(def?.states ?? {}).filter(([, s]) => s.isKpi);
  const displayName = def?.displayName ?? entityType;

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 flex flex-col gap-3 min-w-0">
      <p className="text-xs text-gray-500 uppercase tracking-wide truncate">{displayName}</p>

      {isLoading ? (
        <p className="text-gray-600 text-2xl font-bold tabular-nums">…</p>
      ) : isError ? (
        <p className="text-rose-400 text-sm">Error</p>
      ) : (
        <>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold tabular-nums text-white">{entities.length}</span>
            <span className="text-sm text-gray-500">total</span>
          </div>

          {kpiStates.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {kpiStates.map(([stateKey, stateDef]) => {
                const count = stateCounts[stateKey] ?? 0;
                const tone = stateDef.tone ?? 'slate';
                const colors = TONE_COLORS[tone] ?? TONE_COLORS.slate;
                return (
                  <div key={stateKey} className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${colors.bar}`} />
                    <span className={`text-sm font-semibold tabular-nums ${colors.text}`}>{count}</span>
                    <span className="text-xs text-gray-500">{stateDef.label ?? stateKey}</span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// EntityKpiRow renders a horizontal row of KPI tiles, one per entityType.
// Props:
//   entityTypes  string[]   entity type keys from config.entities
//   label        string?    card section label (unused — each tile is self-labeled)
export default function EntityKpiRow({ entityTypes = [], label }) {
  if (!entityTypes || entityTypes.length === 0) {
    return (
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
        <p className="text-gray-500 text-sm">No entity types configured.</p>
      </div>
    );
  }

  return (
    <div>
      {label && (
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{label}</p>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        {entityTypes.map((et) => (
          <EntityTile key={et} entityType={et} />
        ))}
      </div>
    </div>
  );
}

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useConfig } from '../../config/ConfigContext.jsx';
import { getEntities, unwrapEntities } from '../../api/entities.js';
import { getEntityDef } from './entityConfig.js';
import KpiTile from '../KpiTile.jsx';

// Generic `entity-analytics` screen template: a KPI-tile row + a bar chart of
// counts-by-state for any entity type, config-only. Generalizes OpsOverview.jsx's
// KPI-row + recharts BarChart shape.
export default function EntityAnalyticsPage({ entityType }) {
  const config = useConfig();
  const def = getEntityDef(config, entityType);

  const { data } = useQuery({
    queryKey: ['entities', entityType],
    queryFn: () => getEntities(entityType),
    refetchInterval: 15000,
  });
  const rows = unwrapEntities(data);

  const chartData = useMemo(() => {
    const byState = {};
    for (const r of rows) byState[r.state] = (byState[r.state] ?? 0) + 1;
    return Object.keys(def?.states ?? {}).map((s) => ({
      name: def.states[s]?.label ?? s,
      count: byState[s] ?? 0,
    }));
  }, [rows, def]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiTile label="Total" value={rows.length} color="cyan" />
        {chartData.slice(0, 3).map((c) => (
          <KpiTile key={c.name} label={c.name} value={c.count} color="cyan" />
        ))}
      </div>
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
        <h2 className="text-lg font-semibold text-white mb-4">{def?.displayNamePlural ?? entityType} by state</h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
            <XAxis dataKey="name" stroke="#6b7280" fontSize={11} />
            <YAxis stroke="#6b7280" fontSize={11} allowDecimals={false} />
            <Tooltip contentStyle={{ background: '#111827', border: '1px solid #1f2937' }} />
            <Bar dataKey="count" fill="#22d3ee" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

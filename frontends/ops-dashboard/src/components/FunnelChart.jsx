import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  LabelList,
  ResponsiveContainer,
} from 'recharts';

const COLORS = [
  '#22d3ee', // cyan-400
  '#38bdf8', // sky-400
  '#818cf8', // indigo-400
  '#a78bfa', // violet-400
  '#c084fc', // purple-400
  '#e879f9', // fuchsia-400
];

function pct(first, current) {
  if (!first || !current) return '';
  return `${Math.round((current / first) * 100)}%`;
}

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const d = payload[0].payload;
    return (
      <div className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm">
        <p className="text-white font-medium">{d.name}</p>
        <p className="text-cyan-400">{d.count.toLocaleString()} records</p>
        {d.pct && <p className="text-gray-400">{d.pct} of first stage</p>}
      </div>
    );
  }
  return null;
};

export default function FunnelChart({ data = [], title }) {
  const first = data[0]?.count ?? 0;

  const enriched = data.map((d) => ({
    ...d,
    pct: pct(first, d.count),
  }));

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      {title && <h3 className="text-sm font-semibold text-gray-300 mb-3">{title}</h3>}
      {data.length === 0 ? (
        <p className="text-gray-500 text-sm">No data available</p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart
            data={enriched}
            layout="vertical"
            margin={{ top: 4, right: 80, left: 8, bottom: 4 }}
          >
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="name"
              width={140}
              tick={{ fill: '#9ca3af', fontSize: 12 }}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
              {enriched.map((entry, index) => (
                <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
              ))}
              <LabelList
                dataKey="count"
                position="right"
                formatter={(v) => v.toLocaleString()}
                style={{ fill: '#d1d5db', fontSize: 12 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
      {/* Conversion drop table */}
      {data.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {enriched.slice(1).map((d) => (
            <span
              key={d.name}
              className="text-xs bg-gray-700 rounded px-2 py-0.5 text-gray-300"
            >
              {d.name}: <span className="text-cyan-400 font-medium">{d.pct}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

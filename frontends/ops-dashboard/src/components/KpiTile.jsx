import React from 'react';

const colorMap = {
  cyan: 'text-cyan-400',
  rose: 'text-rose-400',
  green: 'text-green-400',
  yellow: 'text-yellow-400',
};

function TrendArrow({ trend }) {
  if (trend === 'up') return <span className="text-green-400 ml-1">▲</span>;
  if (trend === 'down') return <span className="text-rose-400 ml-1">▼</span>;
  return <span className="text-gray-500 ml-1">—</span>;
}

export default function KpiTile({ label, value, unit, trend, color = 'cyan' }) {
  const valueColor = colorMap[color] ?? 'text-cyan-400';

  return (
    <div className="bg-gray-800 rounded-lg p-4 flex flex-col gap-1 min-w-0">
      <p className="text-xs text-gray-500 uppercase tracking-wide truncate">{label}</p>
      <div className="flex items-baseline gap-1">
        <span className={`text-3xl font-bold tabular-nums ${valueColor}`}>
          {value ?? '—'}
        </span>
        {unit && <span className="text-sm text-gray-400">{unit}</span>}
        {trend && <TrendArrow trend={trend} />}
      </div>
    </div>
  );
}

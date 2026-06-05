import React from 'react';

const severityStyles = {
  critical: 'bg-red-500/20 text-red-400 border border-red-500/30',
  high: 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
  medium: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  low: 'bg-gray-600/40 text-gray-400 border border-gray-600/50',
};

export default function IncidentBadge({ severity }) {
  const style = severityStyles[severity?.toLowerCase()] ?? severityStyles.low;
  return (
    <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${style}`}>
      {severity ?? 'unknown'}
    </span>
  );
}

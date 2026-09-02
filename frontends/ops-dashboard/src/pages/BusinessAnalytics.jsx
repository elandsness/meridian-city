import React from 'react';
import { useQuery } from '@tanstack/react-query';
import FunnelChart from '../components/FunnelChart.jsx';
import { getFunnel } from '../api/analytics.js';
import { useConfig } from '../config/ConfigContext.jsx';

function FunnelSection({ flowKey, label }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['funnel', flowKey],
    queryFn: () => getFunnel(flowKey),
    refetchInterval: 60_000,
  });

  // Backend returns { funnel, stages: [{ stage, count }] }; FunnelChart expects
  // { name, count }. Map at the boundary and unwrap defensively (no error
  // boundaries — a bad shape would blank the page). See docs/API_CONVENTIONS.md.
  const stages = (Array.isArray(data?.stages) ? data.stages : []).map((s) => ({
    name: s.stage,
    count: s.count,
  }));

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 space-y-3">
      <div>
        <h2 className="text-base font-semibold text-white">{label}</h2>
      </div>

      {isLoading ? (
        <div className="bg-gray-800 rounded-lg p-4">
          <p className="text-gray-500 text-sm">Loading funnel…</p>
        </div>
      ) : error ? (
        <div className="bg-gray-800 rounded-lg p-4">
          <p className="text-rose-400 text-sm">Failed to load: {error.message}</p>
        </div>
      ) : (
        <FunnelChart data={stages} title={data?.funnel} />
      )}

      <p className="text-xs text-gray-600 italic">
        Data sourced from Dynatrace Business Events
      </p>
    </div>
  );
}

function toTitleCase(str) {
  return str.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function BusinessAnalytics() {
  const config = useConfig();
  const flowLabels = config?.analytics?.flowLabels ?? {};
  const flows = config?.analytics?.flows ?? ['service-request', 'account-creation', 'iot-incident', 'purchase', 'tax-payment'];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Business Analytics</h1>

      {flows.map((key) => (
        <FunnelSection
          key={key}
          flowKey={key}
          label={flowLabels[key] ?? toTitleCase(key)}
        />
      ))}
    </div>
  );
}

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import FunnelChart from '../components/FunnelChart.jsx';
import { getFunnel } from '../api/analytics.js';

const FUNNELS = [
  {
    key: 'service-request',
    label: 'Service Request Lifecycle',
    description: 'Tracks citizen service requests from submission through resolution.',
  },
  {
    key: 'account-creation',
    label: 'Account Creation',
    description: 'Citizen portal registration and onboarding flow.',
  },
  {
    key: 'iot-incident',
    label: 'IoT Incident Resolution',
    description: 'Device anomaly detection through remediation.',
  },
];

function FunnelSection({ funnel }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['funnel', funnel.key],
    queryFn: () => getFunnel(funnel.key),
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
        <h2 className="text-base font-semibold text-white">{funnel.label}</h2>
        <p className="text-xs text-gray-500 mt-0.5">{funnel.description}</p>
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

export default function BusinessAnalytics() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Business Analytics</h1>

      {FUNNELS.map((f) => (
        <FunnelSection key={f.key} funnel={f} />
      ))}
    </div>
  );
}

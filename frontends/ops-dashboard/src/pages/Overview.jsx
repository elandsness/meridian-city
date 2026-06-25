import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import KpiTile from '../components/KpiTile.jsx';
import { getKpis, getKpiHistory } from '../api/analytics.js';

function formatHHmm(timestamp) {
  try {
    const d = new Date(timestamp);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return timestamp;
  }
}

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm">
        <p className="text-gray-400">{label}</p>
        <p className="text-cyan-400 font-medium">{payload[0].value} requests</p>
      </div>
    );
  }
  return null;
};

export default function Overview() {
  const { data: kpis, isLoading: kpisLoading, error: kpisError } = useQuery({
    queryKey: ['kpis'],
    queryFn: getKpis,
    refetchInterval: 30_000,
  });

  const { data: history = [], isLoading: histLoading } = useQuery({
    queryKey: ['kpis-history', 24],
    queryFn: () => getKpiHistory(24),
    refetchInterval: 60_000,
  });

  const chartData = (Array.isArray(history) ? history : []).map((snap) => ({
    time: formatHHmm(snap.snapshot_at ?? snap.timestamp),
    requests: snap.requests_today ?? 0,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Overview</h1>

      {/* KPI Row */}
      {kpisError ? (
        <p className="text-rose-400 text-sm">Failed to load KPIs: {kpisError.message}</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
          <KpiTile
            label="Requests Today"
            value={kpisLoading ? '…' : kpis?.requests_today}
            color="cyan"
          />
          <KpiTile
            label="Open Requests"
            value={kpisLoading ? '…' : kpis?.requests_open}
            color="yellow"
          />
          <KpiTile
            label="Resolved Today"
            value={kpisLoading ? '…' : kpis?.requests_resolved_today}
            color="green"
          />
          <KpiTile
            label="Open Incidents"
            value={kpisLoading ? '…' : kpis?.incidents_open}
            color={kpis?.incidents_open > 0 ? 'rose' : 'cyan'}
          />
          <KpiTile
            label="IoT Anomalies 24h"
            value={kpisLoading ? '…' : kpis?.iot_anomalies_24h}
            color={kpis?.iot_anomalies_24h > 0 ? 'rose' : 'yellow'}
          />
          <KpiTile
            label="Avg Resolution"
            value={kpisLoading ? '…' : kpis?.avg_resolution_minutes?.toFixed(1)}
            unit="min"
            color="cyan"
          />
          <KpiTile
            label="AI Chats Today"
            value={kpisLoading ? '…' : kpis?.ai_chats_today}
            color="green"
          />
        </div>
      )}

      {/* Requests over time chart */}
      <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
        <h2 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wide">
          Requests Over Time (Last 24h)
        </h2>
        {histLoading ? (
          <p className="text-gray-500 text-sm">Loading chart…</p>
        ) : chartData.length === 0 ? (
          <p className="text-gray-500 text-sm">No historical data available</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="time"
                tick={{ fill: '#6b7280', fontSize: 11 }}
                interval="preserveStartEnd"
              />
              <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="requests" fill="#22d3ee" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

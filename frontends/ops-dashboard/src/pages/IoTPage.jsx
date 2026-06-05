import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import IoTMap from '../components/IoTMap.jsx';
import { getFleetStatus } from '../api/demo.js';
import { useAuth } from '../context/AuthContext.jsx';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

function timeAgo(ts) {
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

const TYPE_COLORS = {
  alert: 'bg-rose-500/20 text-rose-400',
  anomaly: 'bg-orange-500/20 text-orange-400',
  info: 'bg-cyan-500/20 text-cyan-400',
  resolved: 'bg-green-500/20 text-green-400',
};

export default function IoTPage() {
  const { isAuthenticated, token } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const esRef = useRef(null);

  const { data: fleetData } = useQuery({
    queryKey: ['fleet-status'],
    queryFn: getFleetStatus,
    refetchInterval: 15_000,
    retry: false,
  });

  // SSE notification stream
  useEffect(() => {
    if (!isAuthenticated) return;

    function connect() {
      const url = `${API_BASE}/api/v1/notifications/stream`;
      const es = new EventSource(url);
      esRef.current = es;

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setNotifications((prev) => [
            { ...data, _id: Date.now() + Math.random() },
            ...prev,
          ].slice(0, 10));
        } catch {
          // ignore parse errors
        }
      };

      es.onerror = () => {
        es.close();
        // Reconnect after 5s
        setTimeout(connect, 5000);
      };
    }

    connect();

    return () => {
      if (esRef.current) {
        esRef.current.close();
      }
    };
  }, [isAuthenticated, token]);

  const fleet = fleetData ?? { vehicles: 30, buildings: 15, machines: 10 };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">IoT Fleet</h1>

      {/* Fleet summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gray-800 rounded-lg p-4 text-center">
          <p className="text-3xl font-bold text-blue-400">{fleet.vehicles ?? '—'}</p>
          <p className="text-xs text-gray-500 mt-1 uppercase tracking-wide">Vehicles</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 text-center">
          <p className="text-3xl font-bold text-green-400">{fleet.buildings ?? '—'}</p>
          <p className="text-xs text-gray-500 mt-1 uppercase tracking-wide">Buildings</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 text-center">
          <p className="text-3xl font-bold text-orange-400">{fleet.machines ?? '—'}</p>
          <p className="text-xs text-gray-500 mt-1 uppercase tracking-wide">Machines</p>
        </div>
      </div>

      {/* Map */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
            Device Map
          </h2>
        </div>
        <div className="p-4">
          <IoTMap />
        </div>
      </div>

      {/* Live notification feed */}
      <div className="bg-gray-900 rounded-xl border border-gray-800">
        <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
            Live Notifications
          </h2>
          <span className="flex items-center gap-1.5 text-xs text-green-400">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            Live
          </span>
        </div>
        <div className="divide-y divide-gray-800 max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="px-4 py-6 text-gray-500 text-sm">
              Waiting for events…
            </p>
          ) : (
            notifications.map((n) => (
              <div key={n._id} className="px-4 py-3 flex items-start gap-3">
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5 ${
                    TYPE_COLORS[n.type] ?? 'bg-gray-700 text-gray-400'
                  }`}
                >
                  {n.type ?? 'event'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white font-medium truncate">
                    {n.title ?? n.message}
                  </p>
                  {n.title && n.message && (
                    <p className="text-xs text-gray-500 truncate">{n.message}</p>
                  )}
                </div>
                <span className="text-xs text-gray-600 flex-shrink-0">
                  {n.timestamp ? timeAgo(n.timestamp) : ''}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

import { useQuery } from '@tanstack/react-query';
import { getDevices } from '../../api/devices.js';

// Severity helpers — derived from device status + anomaly_type.
function classifyDevice(d) {
  if (d.status === 'alert') return 'critical';
  if (d.status === 'warning') return 'warning';
  return 'info';
}

const SEVERITY_STYLE = {
  critical: { badge: 'bg-rose-500/20 text-rose-400',   dot: 'bg-rose-500',   label: 'Critical' },
  warning:  { badge: 'bg-amber-500/20 text-amber-300', dot: 'bg-amber-400',  label: 'Warning' },
  info:     { badge: 'bg-cyan-500/20 text-cyan-400',   dot: 'bg-cyan-500',   label: 'Info' },
};

// IotAlertsCard: IoT anomaly summary from the device fleet.
// Shows active alert count, severity breakdown, and the 3 most recent alerts.
// Uses the same /api/v1/devices endpoint as IoTPage so no new backend work needed.
export default function IotAlertsCard() {
  const { data: devicesData, isLoading, isError } = useQuery({
    queryKey: ['devices'],
    queryFn: getDevices,
    refetchInterval: 15_000,
    retry: false,
  });

  const devices = Array.isArray(devicesData?.items) ? devicesData.items : [];

  // Only devices in alert or warning state are considered "active alerts".
  const alertDevices = devices.filter((d) => d.status === 'alert' || d.status === 'warning');

  const counts = { critical: 0, warning: 0, info: 0 };
  alertDevices.forEach((d) => { counts[classifyDevice(d)]++; });

  // Most recent 3 alerts — sorted by last_seen desc if available, else take first 3.
  const recent = [...alertDevices]
    .sort((a, b) => {
      const ta = a.last_seen ?? a.updated_at ?? '';
      const tb = b.last_seen ?? b.updated_at ?? '';
      return tb.localeCompare(ta);
    })
    .slice(0, 3);

  const totalAlerts = alertDevices.length;
  const countBadgeClass = totalAlerts > 0 ? 'bg-rose-500 text-white' : 'bg-gray-700 text-gray-400';

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800">
      {/* Header */}
      <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">IoT Alerts</h2>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${countBadgeClass}`}>
          {isLoading ? '…' : totalAlerts}
        </span>
      </div>

      <div className="p-5 space-y-4">
        {isError ? (
          <p className="text-rose-400 text-sm">Failed to load device data.</p>
        ) : isLoading ? (
          <p className="text-gray-500 text-sm">Loading…</p>
        ) : (
          <>
            {/* Severity breakdown */}
            <div className="grid grid-cols-3 gap-2">
              {(['critical', 'warning', 'info']).map((sev) => {
                const s = SEVERITY_STYLE[sev];
                return (
                  <div key={sev} className="bg-gray-800 rounded-lg p-3 text-center">
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                      <span className="text-xs text-gray-500 uppercase tracking-wide">{s.label}</span>
                    </div>
                    <p className={`text-2xl font-bold tabular-nums ${
                      sev === 'critical' ? 'text-rose-400' : sev === 'warning' ? 'text-amber-300' : 'text-cyan-400'
                    }`}>
                      {counts[sev]}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Recent alerts */}
            {recent.length > 0 ? (
              <div>
                <p className="text-xs text-gray-600 uppercase tracking-wide mb-2">Recent</p>
                <div className="flex flex-col gap-2">
                  {recent.map((d) => {
                    const sev = classifyDevice(d);
                    const s = SEVERITY_STYLE[sev];
                    return (
                      <div key={d.device_id} className="flex items-center gap-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${s.badge}`}>
                          {s.label}
                        </span>
                        <span className="font-mono text-gray-400 text-xs flex-1 truncate">{d.device_id}</span>
                        {d.anomaly_type && (
                          <span className="text-xs text-gray-500 truncate">{d.anomaly_type}</span>
                        )}
                        <span className="text-xs text-gray-600 flex-shrink-0">{d.zone ?? ''}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="text-gray-500 text-sm text-center py-2">No active alerts.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

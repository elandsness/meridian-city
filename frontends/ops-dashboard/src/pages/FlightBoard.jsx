import { useQuery } from '@tanstack/react-query';
import { getFlights } from '../api/flights.js';

const STATUS_STYLES = {
  at_gate: 'bg-sky-400/10 text-sky-300',
  servicing: 'bg-amber-400/10 text-amber-300',
  boarding: 'bg-emerald-400/10 text-emerald-300',
  taxiing: 'bg-indigo-400/10 text-indigo-300',
  takeoff: 'bg-cyan-400/10 text-cyan-300',
  departed: 'bg-gray-500/10 text-gray-400',
  approach: 'bg-violet-400/10 text-violet-300',
  landing: 'bg-blue-400/10 text-blue-300',
  taxi_in: 'bg-indigo-400/10 text-indigo-300',
  arrived: 'bg-gray-500/10 text-gray-400',
};

function StatusBadge({ status }) {
  const cls = STATUS_STYLES[status] ?? 'bg-gray-500/10 text-gray-400';
  const label = String(status ?? '—').replace(/_/g, ' ');
  return (
    <span className={`inline-block px-2 py-1 rounded text-xs font-medium capitalize ${cls}`}>{label}</span>
  );
}

export default function FlightBoard() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['flights'],
    queryFn: () => getFlights(),
    refetchInterval: 15_000,
  });

  const flights = Array.isArray(data) ? data : data?.flights ?? data?.items ?? [];
  const departures = flights.filter((f) => f.direction === 'departure');
  const arrivals = flights.filter((f) => f.direction === 'arrival');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Flight Board</h1>
          <p className="text-gray-500 text-sm mt-1">Live departures &amp; arrivals across the airfield.</p>
        </div>
        <button
          onClick={() => refetch()}
          className="text-xs text-gray-500 hover:text-cyan-400 transition-colors"
        >
          ↻ Refresh
        </button>
      </div>

      {error && <p className="text-rose-400 text-sm">Failed to load flights: {error.message}</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        <FlightTable title="Departures" icon="🛫" endpointLabel="To" rows={departures} isLoading={isLoading} />
        <FlightTable title="Arrivals" icon="🛬" endpointLabel="From" rows={arrivals} isLoading={isLoading} />
      </div>
    </div>
  );
}

function FlightTable({ title, icon, endpointLabel, rows, isLoading }) {
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-2">
        <span>{icon}</span>
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        <span className="ml-auto text-xs text-gray-500">{rows.length}</span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wide">
            <th className="px-4 py-2 text-left">Flight</th>
            <th className="px-4 py-2 text-left">{endpointLabel}</th>
            <th className="px-4 py-2 text-left">Gate</th>
            <th className="px-4 py-2 text-left">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
          {isLoading ? (
            <tr>
              <td colSpan={4} className="px-4 py-8 text-center text-gray-500">Loading…</td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-4 py-8 text-center text-gray-500">No flights</td>
            </tr>
          ) : (
            rows.map((f) => (
              <tr key={f.id} className="hover:bg-gray-800/50 transition-colors">
                <td className="px-4 py-3">
                  <div className="text-white font-medium">{f.flight_number ?? '—'}</div>
                  <div className="text-gray-500 text-xs">{f.airline ?? ''}</div>
                </td>
                <td className="px-4 py-3 text-gray-300">
                  {(title === 'Departures' ? f.destination : f.origin) ?? '—'}
                </td>
                <td className="px-4 py-3 text-gray-400">{f.gate ?? '—'}</td>
                <td className="px-4 py-3"><StatusBadge status={f.status} /></td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

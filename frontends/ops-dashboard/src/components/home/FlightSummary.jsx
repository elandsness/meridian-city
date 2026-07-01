import { useQuery } from '@tanstack/react-query';
import KpiTile from '../KpiTile.jsx';
import { getFlights } from '../../api/flights.js';

function unwrap(d) {
  return Array.isArray(d) ? d : d?.flights ?? d?.items ?? [];
}

// Airport ops-home module: a live flight KPI strip at the top of the Overview.
export default function FlightSummary() {
  const { data } = useQuery({
    queryKey: ['flights'],
    queryFn: () => getFlights(),
    refetchInterval: 8000,
  });
  const flights = unwrap(data);
  const activeDep = flights.filter(
    (f) => f.direction === 'departure' && f.status !== 'departed' && f.status !== 'cancelled'
  ).length;
  const activeArr = flights.filter((f) => f.direction === 'arrival' && f.status !== 'arrived').length;
  const boarding = flights.filter((f) => f.status === 'boarding').length;
  const cancelled = flights.filter((f) => f.status === 'cancelled').length;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <KpiTile label="Active Departures" value={activeDep} color="cyan" />
      <KpiTile label="Active Arrivals" value={activeArr} color="yellow" />
      <KpiTile label="Boarding Now" value={boarding} color="green" />
      <KpiTile label="Cancelled" value={cancelled} color={cancelled > 0 ? 'rose' : 'cyan'} />
    </div>
  );
}

import { useQuery } from '@tanstack/react-query';
import KpiTile from '../KpiTile.jsx';
import { getEntities, unwrapEntities } from '../../api/entities.js';

// Airport ops-home module: live flight KPI strip backed by entity engine.
export default function FlightSummary() {
  const { data: depData } = useQuery({
    queryKey: ['entities', 'flight_departure'],
    queryFn: () => getEntities('flight_departure'),
    refetchInterval: 8000,
  });
  const { data: arrData } = useQuery({
    queryKey: ['entities', 'flight_arrival'],
    queryFn: () => getEntities('flight_arrival'),
    refetchInterval: 8000,
  });

  const deps = unwrapEntities(depData);
  const arrs = unwrapEntities(arrData);

  const activeDep = deps.filter((f) => f.state !== 'departed' && f.state !== 'cancelled').length;
  const activeArr = arrs.filter((f) => f.state !== 'arrived' && f.state !== 'diverted').length;
  const boarding = deps.filter((f) => f.state === 'boarding').length;
  const cancelled = deps.filter((f) => f.state === 'cancelled').length;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <KpiTile label="Active Departures" value={activeDep} color="cyan" />
      <KpiTile label="Active Arrivals" value={activeArr} color="yellow" />
      <KpiTile label="Boarding Now" value={boarding} color="green" />
      <KpiTile label="Cancelled" value={cancelled} color={cancelled > 0 ? 'rose' : 'cyan'} />
    </div>
  );
}

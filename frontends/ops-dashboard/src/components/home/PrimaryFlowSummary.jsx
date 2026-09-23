import { useQuery } from '@tanstack/react-query';
import KpiTile from '../KpiTile.jsx';
import { getEntities, unwrapEntities } from '../../api/entities.js';
import { useConfig } from '../../context/ConfigContext.jsx';

export default function PrimaryFlowSummary() {
  const { config } = useConfig();
  
  // Dynamically resolve the primary flow and entity type from the industry config
  const primaryFlow = config?.industry?.primaryFlow || 'flight_departure';
  const flowCfg = config?.industry?.flows?.[primaryFlow];
  const entityType = flowCfg?.entityType || 'flight_departure';
  const flowLabel = config?.industry?.terminology?.flows?.[primaryFlow] || primaryFlow.replace('_', ' ');

  const { data: entities } = useQuery({
    queryKey: ['entities', entityType],
    queryFn: () => getEntities(entityType),
    refetchInterval: 8000,
  });

  const items = unwrapEntities(entities);

  // Derive KPIs based on the generic flow definition configuration
  const activeStates = flowCfg?.activeStates || ['boarding', 'taxiing']; 
  const terminalStates = flowCfg?.terminalStates || ['departed', 'cancelled'];

  const activeCount = items.filter((i) => activeStates.includes(i.state)).length;
  const terminalCount = items.filter((i) => terminalStates.includes(i.state)).length;
  const boardingCount = items.filter((i) => i.state === 'boarding').length;

  return (
    <div className="grid grid-cols-2 sm:gap-3 sm:grid-cols-4 gap-3">
      <KpiTile label={`${flowLabel} (Active)`} value={activeCount} color="cyan" />
      <KpiTile label={`${flowLabel} (Terminal)`} value={terminalCount} color="yellow" />
      <KpiTile label="Boarding/Processing" value={boardingCount} color="green" />
      <KpiTile label="Issues" value={items.filter(i => i.state === 'cancelled' || i.state === 'error').length} color="rose" />
    </div>
  );
}

import { useQuery } from '@tanstack/react-query';
import { useConfig } from '../../config/ConfigContext.jsx';
import { getDevices } from '../../api/devices.js';
import { getEntities, unwrapEntities } from '../../api/entities.js';
import EntityMap from '../entitymap/EntityMap.jsx';

// Status color palette for device/entity status values.
// Config `statusColors` map overrides any of these.
const DEFAULT_STATUS_COLORS = {
  // IoT device statuses
  ok: '#16a34a',
  warning: '#d97706',
  alert: '#dc2626',
  // Entity state tones
  green: '#16a34a',
  amber: '#d97706',
  orange: '#ea580c',
  red: '#dc2626',
  blue: '#2563eb',
  slate: '#94a3b8',
  // Semantic aliases (parking/seating use cases)
  available: '#16a34a',
  occupied: '#dc2626',
  reserved: '#d97706',
};

// Spread `count` items in a compact grid around a center point.
function gridPositions(center, count, spacing = 30) {
  const cols = Math.ceil(Math.sqrt(count * 1.5));
  const rows = Math.ceil(count / cols);
  const positions = [];
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const rowCount = Math.min(count - row * cols, cols);
    positions.push({
      x: center.x + (col - (rowCount - 1) / 2) * spacing,
      y: center.y + (row - (rows - 1) / 2) * spacing,
    });
  }
  return positions;
}

// Generic `status-map` screen template. Renders items at static configured
// positions with real-time status colors from the devices API or entity engine.
// Supports two modes driven by which config keys are present:
//
//   locations[] — explicit per-item x,y (seating charts, parking lots)
//   clusterBy: "zone" — auto-grid each zone around iotZonePositions centers
//
// The background, viewBox, and legend are all config-driven via the screen
// entry in screens.ops, matching the same shape EntityMapPage uses.
export default function StatusMapPage({
  viewBox,
  background,
  source,
  entityType,
  clusterBy,
  locations,
  statusColors,
  labelField,
  title,
}) {
  const config = useConfig();
  const term = config?.terminology ?? {};
  const colorMap = { ...DEFAULT_STATUS_COLORS, ...(statusColors ?? {}) };

  const isDevices = source === 'devices' || (!entityType && !source);

  const { data: devicesData, isLoading: devicesLoading } = useQuery({
    queryKey: ['devices'],
    queryFn: getDevices,
    refetchInterval: 15_000,
    enabled: isDevices,
  });

  const { data: entitiesData, isLoading: entitiesLoading } = useQuery({
    queryKey: ['entities', entityType],
    queryFn: () => getEntities(entityType),
    refetchInterval: 15_000,
    enabled: !isDevices && !!entityType,
  });

  const isLoading = isDevices ? devicesLoading : entitiesLoading;

  let sprites = [];

  if (locations && locations.length > 0) {
    // Explicit per-item positions: match each location's id to live status
    const statusById = {};
    if (isDevices) {
      for (const d of Array.isArray(devicesData?.items) ? devicesData.items : []) {
        statusById[d.device_id] = d.status;
      }
    } else {
      for (const e of unwrapEntities(entitiesData)) {
        statusById[e.id] = e.state;
      }
    }
    sprites = locations.map((loc) => ({
      id: loc.id,
      coordinate: { x: loc.x, y: loc.y },
      color: colorMap[statusById[loc.id]] ?? colorMap.slate,
      label: loc.label,
    }));
  } else if (clusterBy === 'zone' && isDevices) {
    // Auto-cluster devices around zone centers from terminology.iotZonePositions
    const zonePositions = term.iotZonePositions ?? {};
    const devices = Array.isArray(devicesData?.items) ? devicesData.items : [];

    const byZone = {};
    for (const d of devices) {
      const z = d.zone ?? 'unknown';
      if (!byZone[z]) byZone[z] = [];
      byZone[z].push(d);
    }

    for (const [zone, devs] of Object.entries(byZone)) {
      const center = zonePositions[zone];
      if (!center) continue;
      const positions = gridPositions(center, devs.length, 32);
      devs.forEach((d, i) => {
        sprites.push({
          id: d.device_id,
          coordinate: positions[i],
          color: colorMap[d.status] ?? colorMap.slate,
        });
      });
    }
  }

  const legend = [
    { color: colorMap.ok, label: 'Healthy' },
    { color: colorMap.warning, label: 'Warning' },
    { color: colorMap.alert, label: 'Alert' },
  ];

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
      {title && (
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <span className="text-xs text-gray-500">{sprites.length} locations</span>
        </div>
      )}
      <EntityMap
        viewBox={viewBox ?? '0 0 1000 580'}
        background={background}
        sprites={sprites}
        legend={legend}
        emptyMessage={isLoading ? 'Loading…' : 'No data available.'}
      />
    </div>
  );
}

import { useQuery } from '@tanstack/react-query'
import { useConfig } from '../../config/ConfigContext.jsx'
import { getDevices } from '../../api/devices.js'
import { getEntities, unwrapEntities } from '../../api/entities.js'
import EntityMap from '../entitymap/EntityMap.jsx'
import Card from '../../ui/Card.jsx'

const DEFAULT_STATUS_COLORS = {
  ok: '#16a34a',
  warning: '#d97706',
  alert: '#dc2626',
  green: '#16a34a',
  amber: '#d97706',
  orange: '#ea580c',
  red: '#dc2626',
  blue: '#2563eb',
  slate: '#94a3b8',
  available: '#16a34a',
  occupied: '#dc2626',
  reserved: '#d97706',
}

function gridPositions(center, count, spacing = 30) {
  const cols = Math.ceil(Math.sqrt(count * 1.5))
  const rows = Math.ceil(count / cols)
  const positions = []
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / cols)
    const col = i % cols
    const rowCount = Math.min(count - row * cols, cols)
    positions.push({
      x: center.x + (col - (rowCount - 1) / 2) * spacing,
      y: center.y + (row - (rows - 1) / 2) * spacing,
    })
  }
  return positions
}

// Generic `status-map` public-portal screen template. Static item positions
// from config, real-time status colors from the devices API or entity engine.
// Works for ATM locators, seating charts, parking lots — anything where items
// have fixed locations and only their status changes.
export default function StatusMapPage({
  viewBox,
  background,
  source,
  entityType,
  clusterBy,
  locations,
  statusColors,
  labelField,
  label,
  title,
}) {
  const config = useConfig()
  const term = config?.terminology ?? {}
  const colorMap = { ...DEFAULT_STATUS_COLORS, ...(statusColors ?? {}) }

  const isDevices = source === 'devices' || (!entityType && !source)

  const { data: devicesData, isLoading: devicesLoading } = useQuery({
    queryKey: ['devices'],
    queryFn: getDevices,
    refetchInterval: 15_000,
    enabled: isDevices,
  })

  const { data: entitiesData, isLoading: entitiesLoading } = useQuery({
    queryKey: ['entities', entityType],
    queryFn: () => getEntities(entityType),
    refetchInterval: 15_000,
    enabled: !isDevices && !!entityType,
  })

  const isLoading = isDevices ? devicesLoading : entitiesLoading

  let sprites = []

  if (locations && locations.length > 0) {
    const statusById = {}
    if (isDevices) {
      for (const d of Array.isArray(devicesData?.items) ? devicesData.items : []) {
        statusById[d.device_id] = d.status
      }
    } else {
      for (const e of unwrapEntities(entitiesData)) {
        statusById[e.id] = e.state
      }
    }
    sprites = locations.map((loc) => ({
      id: loc.id,
      coordinate: { x: loc.x, y: loc.y },
      color: colorMap[statusById[loc.id]] ?? colorMap.slate,
      label: loc.label,
    }))
  } else if (clusterBy === 'zone' && isDevices) {
    const zonePositions = term.iotZonePositions ?? {}
    const devices = Array.isArray(devicesData?.items) ? devicesData.items : []

    const byZone = {}
    for (const d of devices) {
      const z = d.zone ?? 'unknown'
      if (!byZone[z]) byZone[z] = []
      byZone[z].push(d)
    }

    for (const [zone, devs] of Object.entries(byZone)) {
      const center = zonePositions[zone]
      if (!center) continue
      const positions = gridPositions(center, devs.length, 32)
      devs.forEach((d, i) => {
        sprites.push({
          id: d.device_id,
          coordinate: positions[i],
          color: colorMap[d.status] ?? colorMap.slate,
        })
      })
    }
  }

  const legend = [
    { color: colorMap.ok, label: 'Operational' },
    { color: colorMap.warning, label: 'Degraded' },
    { color: colorMap.alert, label: 'Out of Service' },
  ]

  const heading = title ?? label ?? 'Map'

  return (
    <Card title={heading} action={<span className="text-xs text-slate-400">{isLoading ? '…' : `${sprites.length} locations`}</span>}>
      <EntityMap
        viewBox={viewBox ?? '0 0 1000 580'}
        background={background}
        sprites={sprites}
        legend={legend}
        emptyMessage={isLoading ? 'Loading…' : 'No locations configured.'}
      />
    </Card>
  )
}

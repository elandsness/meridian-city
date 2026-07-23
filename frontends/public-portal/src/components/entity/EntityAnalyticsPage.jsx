import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useConfig } from '../../config/ConfigContext.jsx'
import { getEntities, unwrapEntities } from '../../api/entities.js'
import { getEntityDef } from './entityConfig.js'
import Card from '../../ui/Card.jsx'

// Generic `entity-analytics` screen template: a KPI-tile row summarizing
// counts by state for any entity type, config-only. (public-portal has no
// chart library dependency the way ops-dashboard does, so this stays to
// simple tiles here; ops-dashboard's version adds a bar chart.)
export default function EntityAnalyticsPage({ entityType }) {
  const config = useConfig()
  const def = getEntityDef(config, entityType)

  const { data } = useQuery({
    queryKey: ['entities', entityType],
    queryFn: () => getEntities(entityType),
    refetchInterval: 15000,
  })
  const rows = unwrapEntities(data)

  const counts = useMemo(() => {
    const byState = {}
    for (const r of rows) byState[r.state] = (byState[r.state] ?? 0) + 1
    return byState
  }, [rows])

  const states = Object.keys(def?.states ?? {})

  return (
    <Card title={`${def?.displayNamePlural ?? entityType} overview`}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile label="Total" value={rows.length} />
        {states.map((s) => (
          <StatTile key={s} label={def.states[s]?.label ?? s} value={counts[s] ?? 0} />
        ))}
      </div>
    </Card>
  )
}

function StatTile({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <p className="text-xs text-slate-400 uppercase tracking-wide truncate">{label}</p>
      <p className="text-2xl font-semibold text-slate-900 mt-1">{value}</p>
    </div>
  )
}

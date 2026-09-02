import { useQuery } from '@tanstack/react-query'
import Card from '../../ui/Card.jsx'
import { useConfig } from '../../config/ConfigContext'
import { getEntities, unwrapEntities } from '../../api/entities.js'

const TONE_BG = {
  slate: 'bg-slate-100 text-slate-700',
  blue: 'bg-blue-50 text-blue-700',
  green: 'bg-green-50 text-green-700',
  amber: 'bg-amber-50 text-amber-700',
  orange: 'bg-orange-50 text-orange-700',
  red: 'bg-red-50 text-red-700',
  purple: 'bg-purple-50 text-purple-700',
}

export default function EntitySummaryCard({ entityType, label }) {
  const cfg = useConfig()
  const def = cfg.entities?.[entityType]

  const { data, isLoading, isError } = useQuery({
    queryKey: ['entities', entityType],
    queryFn: () => getEntities(entityType),
    refetchInterval: 10000,
  })

  const entities = unwrapEntities(data)

  const stateCounts = entities.reduce((acc, e) => {
    const s = e.state ?? e.status ?? 'unknown'
    acc[s] = (acc[s] ?? 0) + 1
    return acc
  }, {})

  const kpiStates = Object.entries(def?.states ?? {}).filter(([, s]) => s.isKpi)

  const cardTitle = label ?? def?.displayName ?? entityType

  return (
    <Card title={cardTitle}>
      {isLoading ? (
        <p className="text-slate-400 text-sm">Loading…</p>
      ) : isError ? (
        <p className="text-red-500 text-sm">Failed to load.</p>
      ) : (
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex flex-col items-center">
            <span className="text-2xl font-bold text-slate-900">{entities.length}</span>
            <span className="text-xs text-slate-500 uppercase tracking-wide">Total</span>
          </div>
          {kpiStates.map(([stateKey, stateDef]) => {
            const count = stateCounts[stateKey] ?? 0
            const tone = stateDef.tone ?? 'slate'
            const cls = TONE_BG[tone] ?? TONE_BG.slate
            return (
              <div key={stateKey} className={`flex flex-col items-center px-3 py-1.5 rounded-xl ${cls}`}>
                <span className="text-xl font-bold">{count}</span>
                <span className="text-xs font-medium uppercase tracking-wide">{stateDef.label ?? stateKey}</span>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

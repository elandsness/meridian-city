import React from 'react'
import Card from '../../ui/Card.jsx'
import JourneyStepper from './JourneyStepper.jsx'

export default function EntityCard({ entity, def, stepsProp, label }) {
  const displayId = entity.id?.slice(-6) ?? entity.id
  const stateMeta = def?.states?.[entity.state] ?? {}
  const toneClass = {
    slate: 'bg-slate-100 text-slate-600',
    blue: 'bg-blue-50 text-blue-700',
    amber: 'bg-amber-50 text-amber-700',
    orange: 'bg-orange-50 text-orange-700',
    green: 'bg-green-50 text-green-700',
    red: 'bg-red-50 text-red-700',
  }[stateMeta.tone] ?? 'bg-slate-100 text-slate-600'

  return (
    <Card>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <p className="font-semibold text-slate-900">{def?.displayName ?? label} #{displayId}</p>
          <p className="text-xs text-slate-400 mt-0.5">
            {entity.created_at ? new Date(entity.created_at).toLocaleString() : ''}
          </p>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${toneClass}`}>
          {stateMeta.label ?? entity.state}
        </span>
      </div>
      <JourneyStepper entity={entity} def={def} stepsProp={stepsProp} />
    </Card>
  )
}

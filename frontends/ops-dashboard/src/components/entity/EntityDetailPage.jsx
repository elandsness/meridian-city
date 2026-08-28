// EntityDetailPage — generic entity detail view for the ops dashboard.

import { useConfig } from '../../config/ConfigContext'

export default function EntityDetailPage({ entityType, entityId, config }) {
  const entityDef = (config?.entities || []).find((e) => e.id === entityType)
  const label = entityDef?.label || entityType || 'Entity'
  const id = entityId || '-'

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
      <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wide mb-3">
        {label}
      </h3>
      <dl className="space-y-1 text-sm">
        <dt className="text-slate-400">ID</dt>
        <dd className="font-mono text-slate-200">{id}</dd>
      </dl>
    </div>
  )
}

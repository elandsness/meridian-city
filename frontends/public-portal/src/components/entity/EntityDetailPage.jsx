// EntityDetailPage — generic entity detail view.
// Renders a configurable detail page for a single entity.
// Part of the generic component library for the PageComposer pattern.

import { useConfig } from '../../config/ConfigContext'

export default function EntityDetailPage({ entityType, entityId, config }) {
  const entityDef = (config?.entities || []).find((e) => e.id === entityType)
  const label = entityDef?.label || entityType || 'Entity'
  const id = entityId || '—'

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-3">
        {label}
      </h3>
      <dl className="space-y-1 text-sm">
        <dt className="text-slate-500">ID</dt>
        <dd className="font-mono text-slate-900">{id}</dd>
      </dl>
    </div>
  )
}

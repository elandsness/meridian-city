// EntityListPage — generic entity list view.
// Renders a configurable list of entities based on entityType from config.
// Part of the generic component library for the PageComposer pattern.

import { useConfig } from '../../config/ConfigContext'

export default function EntityListPage({ entityType, config }) {
  const cfg = useConfig()
  const entityDef = (config?.entities || []).find((e) => e.id === entityType)
  const label = entityDef?.pluralLabel || entityType || 'Entities'

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-3">
        {label}
      </h3>
      <p className="text-sm text-slate-500">
        Entity list view for <code className="text-xs bg-slate-100 px-1 rounded">{entityType}</code>
      </p>
    </div>
  )
}

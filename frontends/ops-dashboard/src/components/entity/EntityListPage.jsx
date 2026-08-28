// EntityListPage — generic entity list view for the ops dashboard.
// Renders a configurable list of entities based on entityType from config.

import { useConfig } from '../../config/ConfigContext'

export default function EntityListPage({ entityType, config }) {
  const entityDef = (config?.entities || []).find((e) => e.id === entityType)
  const label = entityDef?.pluralLabel || entityType || 'Entities'

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
      <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wide mb-3">
        {label}
      </h3>
      <p className="text-sm text-slate-400">
        Entity list view for <code className="text-xs bg-slate-700 px-1 rounded">{entityType}</code>
      </p>
    </div>
  )
}

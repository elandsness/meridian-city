// Generic entity list page — renders a table of entities from the entity engine.
// Currently a placeholder; will be implemented as part of the entity engine reskin.

export default function EntityListPage({ entityType, config }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-400">
      Entity list for <code>{entityType}</code> — coming soon
    </div>
  )
}

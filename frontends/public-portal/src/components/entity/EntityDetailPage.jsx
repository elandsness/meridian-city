// Generic entity detail page — renders a single entity with its fields.
// Currently a placeholder; will be implemented as part of the entity engine reskin.

export default function EntityDetailPage({ entityType, entityId, config }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-400">
      Entity detail for <code>{entityType}</code> (#<code>{entityId}</code>) — coming soon
    </div>
  )
}

// EntityMapPage — generic entity map view for the ops dashboard.

export default function EntityMapPage({ entityType, config }) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
      <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wide mb-3">
        {entityType || 'Entities'} Map
      </h3>
      <div className="bg-slate-700 rounded-lg h-48 flex items-center justify-center text-slate-400 text-sm">
        Map view for {entityType || 'entities'}
      </div>
    </div>
  )
}

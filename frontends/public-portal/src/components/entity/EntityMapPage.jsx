// EntityMapPage — generic entity map view.
// Renders entities on a map based on entityType from config.
// Part of the generic component library for the PageComposer pattern.

export default function EntityMapPage({ entityType, config }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-3">
        {entityType || 'Entities'} Map
      </h3>
      <div className="bg-slate-100 rounded-lg h-48 flex items-center justify-center text-slate-400 text-sm">
        Map view for {entityType || 'entities'}
      </div>
    </div>
  )
}

// EntityJourneyPage — generic entity journey view.
// Renders a timeline/journey for a given entityType.
// Part of the generic component library for the PageComposer pattern.

export default function EntityJourneyPage({ entityType, config }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-3">
        {entityType || 'Entity'} Journey
      </h3>
      <div className="bg-slate-100 rounded-lg h-48 flex items-center justify-center text-slate-400 text-sm">
        Journey view for {entityType || 'entity'}
      </div>
    </div>
  )
}

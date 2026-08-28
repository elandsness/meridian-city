import Badge from '../ui/Badge.jsx'

// Configurable transit route display for the ops dashboard.
// When `routes` is provided via props (from the PageComposer / industry config),
// those routes are used. Otherwise falls back to default shuttle routes.

const DEFAULT_ROUTES = [
  {
    name: 'Shuttle Route 1',
    stops: ['Central Station', 'Airport', 'Tech Park'],
  },
  {
    name: 'Shuttle Route 2',
    stops: ['Downtown', 'Hospital', 'Stadium'],
  },
]

export default function TransitPanel({ routes, config }) {
  const panelRoutes = routes && routes.length > 0 ? routes : DEFAULT_ROUTES

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
      <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">
        Transit Routes
      </h3>
      <div className="space-y-3">
        {panelRoutes.map((route, index) => (
          <div key={index} className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs font-medium text-slate-600 flex-none">
              {index + 1}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-900">{route.name}</p>
              <ul className="mt-1 space-y-0.5">
                {route.stops.map((stop, stopIndex) => (
                  <li key={stopIndex} className="text-xs text-slate-500 flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-slate-300 flex-none" />
                    {stop}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

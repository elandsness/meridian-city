import { useQuery } from '@tanstack/react-query'
import { getIncidents } from '../api/incidents.js'
import CityMap from '../components/CityMap.jsx'
import ChatWidget from '../components/ChatWidget.jsx'

const SEVERITY_COLORS = {
  critical: 'bg-red-500 text-white',
  high: 'bg-orange-500 text-white',
  medium: 'bg-yellow-500 text-black',
  low: 'bg-slate-500 text-white',
}

function IncidentCard({ incident }) {
  const badgeClass = SEVERITY_COLORS[incident.severity] || SEVERITY_COLORS.low
  return (
    <div className="bg-slate-700 rounded-xl p-4 flex items-start justify-between gap-4">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-white truncate">{incident.title}</p>
        <p className="text-sm text-slate-400 mt-1 line-clamp-2">{incident.description}</p>
        {incident.location_name && (
          <p className="text-xs text-slate-500 mt-1">📍 {incident.location_name}</p>
        )}
      </div>
      <span className={`text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap ${badgeClass}`}>
        {incident.severity || 'unknown'}
      </span>
    </div>
  )
}

export default function Home() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['incidents', 'open'],
    queryFn: () => getIncidents({ status: 'open', limit: 3 }),
  })

  const incidents = Array.isArray(data) ? data : data?.incidents || []

  return (
    <div className="space-y-10">
      {/* Hero */}
      <section className="text-center py-12">
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
          Welcome to Meridian City
        </h1>
        <p className="text-lg text-slate-400 max-w-2xl mx-auto">
          Your one-stop portal for city services, real-time incident updates, and community support.
        </p>
      </section>

      {/* Active Incidents */}
      <section>
        <h2 className="text-xl font-semibold text-white mb-4">Active Incidents</h2>
        {isLoading && <p className="text-slate-400">Loading...</p>}
        {isError && <p className="text-red-400">Failed to load incidents.</p>}
        {!isLoading && !isError && incidents.length === 0 && (
          <div className="bg-slate-800 rounded-xl p-6 text-center">
            <span className="text-green-400 text-lg">✓</span>
            <p className="text-slate-300 mt-1">No active incidents</p>
          </div>
        )}
        {!isLoading && incidents.length > 0 && (
          <div className="space-y-3">
            {incidents.map((inc) => (
              <IncidentCard key={inc.id} incident={inc} />
            ))}
          </div>
        )}
      </section>

      {/* City Map */}
      <section>
        <h2 className="text-xl font-semibold text-white mb-4">City Map</h2>
        <div className="bg-slate-800 rounded-xl overflow-hidden p-1">
          <CityMap incidents={incidents} />
        </div>
      </section>

      <ChatWidget />
    </div>
  )
}

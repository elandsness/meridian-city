import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getIncidents } from '../api/incidents.js'
import { getServiceRequests } from '../api/serviceRequests.js'
import CityMap from '../components/CityMap.jsx'
import Card from '../ui/Card.jsx'
import StatTile from '../ui/StatTile.jsx'
import Button from '../ui/Button.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useNotifications } from '../context/NotificationContext.jsx'
import { useChat } from '../context/ChatContext.jsx'
import { timeAgo, displayName, greeting, severityMeta, severityRank } from '../lib/format.js'

const OPEN_STATUSES = new Set(['submitted', 'dispatched', 'assigned', 'acknowledged', 'in_progress'])

function unwrap(d, ...keys) {
  if (Array.isArray(d)) return d
  for (const k of keys) if (Array.isArray(d?.[k])) return d[k]
  return []
}

function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-red-600">
      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
      Live
    </span>
  )
}

function IncidentRow({ incident }) {
  const meta = severityMeta(incident.severity)
  const sub = [incident.location_name, incident.status].filter(Boolean).join(' · ')
  return (
    <div className="flex gap-3 py-2.5 border-b border-slate-100 last:border-0">
      <span className={`mt-1.5 w-2 h-2 rounded-full flex-none ${meta.dot}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-900 truncate">{incident.title}</p>
        {sub && <p className="text-xs text-slate-500 mt-0.5 capitalize">{sub}</p>}
      </div>
      <span className="text-xs text-slate-400 whitespace-nowrap">{timeAgo(incident.created_at)}</span>
    </div>
  )
}

const QA_ICONS = {
  report: <path d="M12 5v14M5 12h14" />,
  list: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
  chat: <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />,
}

function QuickAction({ icon, title, subtitle, to, onClick }) {
  const inner = (
    <>
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-meridian-blue" aria-hidden="true">
        {QA_ICONS[icon]}
      </svg>
      <div className="font-medium text-slate-900">{title}</div>
      <div className="text-xs text-slate-500">{subtitle}</div>
    </>
  )
  const cls =
    'bg-white rounded-2xl border border-slate-200 p-4 flex flex-col gap-2 hover:border-slate-300 transition-colors text-left w-full'
  if (to) return <Link to={to} className={cls}>{inner}</Link>
  return <button type="button" onClick={onClick} className={cls}>{inner}</button>
}

export default function Home() {
  const { isAuthenticated, user } = useAuth()
  const { notifications, unreadCount } = useNotifications()
  const { openChat } = useChat()

  const { data: incData, isLoading, isError } = useQuery({
    queryKey: ['incidents', 'open'],
    queryFn: () => getIncidents({ status: 'open', limit: 50 }),
    refetchInterval: 30000,
  })

  const { data: reqData } = useQuery({
    queryKey: ['my-requests', user?.id],
    queryFn: () => getServiceRequests({ citizen_id: user?.id, limit: 50 }),
    enabled: isAuthenticated,
    refetchInterval: 60000,
  })

  const incidents = unwrap(incData, 'incidents', 'items')
  const requests = unwrap(reqData, 'items', 'service_requests', 'requests')
  const feed = [...incidents]
    .sort(
      (a, b) =>
        severityRank(b.severity) - severityRank(a.severity) ||
        new Date(b.created_at || 0) - new Date(a.created_at || 0)
    )
    .slice(0, 5)

  const myOpen = requests.filter((r) => OPEN_STATUSES.has((r.status || '').toLowerCase())).length
  const myResolved = requests.filter((r) => (r.status || '').toLowerCase() === 'resolved').length
  const messages = notifications.slice(0, 4)

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {isAuthenticated ? `${greeting()}, ${displayName(user)}` : 'Welcome to Meridian City'}
          </h1>
          <p className="text-slate-500 mt-1">Here's what's happening across Meridian City today.</p>
        </div>
        {!isAuthenticated && (
          <div className="flex gap-2">
            <Button to="/login" variant="primary">Log in</Button>
            <Button to="/register" variant="outline">Register</Button>
          </div>
        )}
      </section>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <StatTile
          label="Open incidents"
          value={isLoading ? '—' : incidents.length}
          valueClassName={incidents.length > 0 ? 'text-red-600' : 'text-slate-900'}
        />
        {isAuthenticated && <StatTile label="My open requests" value={myOpen} />}
        {isAuthenticated && <StatTile label="Resolved for me" value={myResolved} />}
        <StatTile label="Monitored zones" value="5" sub="north · south · east · west · central" />
      </div>

      {/* Incidents + side column */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2" title="Live incidents" action={<LiveBadge />}>
          {isLoading && <p className="text-slate-400 text-sm">Loading…</p>}
          {isError && <p className="text-red-500 text-sm">Failed to load incidents.</p>}
          {!isLoading && !isError && feed.length === 0 && (
            <p className="text-slate-500 text-sm py-4 text-center">No active incidents — all clear.</p>
          )}
          {feed.length > 0 && (
            <div className="-my-1">
              {feed.map((inc) => (
                <IncidentRow key={inc.id} incident={inc} />
              ))}
            </div>
          )}
        </Card>

        {isAuthenticated ? (
          <Card
            title="Messages"
            action={
              unreadCount > 0 ? (
                <span className="text-xs bg-meridian-tint text-meridian-blue px-2 py-0.5 rounded-full">
                  {unreadCount} new
                </span>
              ) : null
            }
          >
            {messages.length === 0 ? (
              <p className="text-slate-500 text-sm py-4 text-center">No messages yet.</p>
            ) : (
              <div className="-my-1">
                {messages.map((m, i) => (
                  <div key={m.id || i} className="py-2.5 border-b border-slate-100 last:border-0">
                    <p className="text-sm text-slate-900">{m.title || 'Notification'}</p>
                    {m.message && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{m.message}</p>}
                  </div>
                ))}
              </div>
            )}
          </Card>
        ) : (
          <Card title="Join Meridian City">
            <p className="text-sm text-slate-600">
              Create an account to submit service requests, track incidents near you, pay city
              bills, and shop the city store.
            </p>
            <div className="flex gap-2 mt-4">
              <Button to="/register" variant="primary" size="sm">Create account</Button>
              <Button to="/login" variant="outline" size="sm">Log in</Button>
            </div>
          </Card>
        )}
      </div>

      {/* City map */}
      <Card title="City map — IoT devices" bodyClassName="!p-2">
        <div className="rounded-xl overflow-hidden">
          <CityMap incidents={incidents} />
        </div>
      </Card>

      {/* Quick actions */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <QuickAction icon="report" title="Report an issue" subtitle="Submit a service request" to="/service-requests/new" />
        <QuickAction icon="list" title="My requests" subtitle="Track your submissions" to="/service-requests" />
        <QuickAction icon="chat" title="Ask Meri" subtitle="City AI assistant" onClick={openChat} />
      </div>
    </div>
  )
}

import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getIncidents } from '../api/incidents.js'
import { getServiceRequests } from '../api/serviceRequests.js'
import { getBills } from '../api/billing.js'
import { getMessages } from '../api/messages.js'
import { getDevices } from '../api/devices.js'
import TransitMap from '../components/TransitMap.jsx'
import TransitStatus from '../components/TransitStatus.jsx'
import Card from '../ui/Card.jsx'
import StatTile from '../ui/StatTile.jsx'
import Button from '../ui/Button.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useChat } from '../context/ChatContext.jsx'
import { timeAgo, displayName, greeting, severityMeta, severityRank, formatCents } from '../lib/format.js'

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
  store: <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0" />,
  pay: <path d="M5 3v18l2-1 2 1 2-1 2 1 2-1 2 1V3l-2 1-2-1-2 1-2-1-2 1-2-1zM9 9h6M9 13h6" />,
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
  const { openChat } = useChat()

  const { data: incData, isLoading, isError } = useQuery({
    queryKey: ['incidents', 'open'],
    queryFn: () => getIncidents({ status: 'open', limit: 50 }),
    refetchInterval: 30000,
  })

  const { data: devicesData } = useQuery({
    queryKey: ['devices'],
    queryFn: getDevices,
    refetchInterval: 30000,
  })

  const { data: reqData } = useQuery({
    queryKey: ['my-requests', user?.id],
    queryFn: () => getServiceRequests({ citizen_id: user?.id, limit: 50 }),
    enabled: isAuthenticated,
    refetchInterval: 60000,
  })

  const { data: billsData } = useQuery({
    queryKey: ['bills', user?.id, 'outstanding'],
    queryFn: () => getBills(user?.id, 'outstanding'),
    enabled: isAuthenticated,
    refetchInterval: 60000,
  })

  const { data: messagesData } = useQuery({
    queryKey: ['messages', user?.id],
    queryFn: () => getMessages(user?.id),
    enabled: isAuthenticated,
    refetchInterval: 20000,
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
  const bills = unwrap(billsData, 'items')
  // Defensive: only outstanding bills count toward the balance, regardless of payload.
  const balanceCents = bills
    .filter((b) => (b.status || '').toLowerCase() === 'outstanding')
    .reduce((sum, b) => sum + (b.amount_cents || 0), 0)
  const messages = (Array.isArray(messagesData?.messages) ? messagesData.messages : []).slice(0, 4)
  const unreadCount = messagesData?.unread ?? 0

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
        {isAuthenticated && (
          <StatTile
            label="Balance due"
            value={formatCents(balanceCents)}
            valueClassName={balanceCents > 0 ? 'text-red-600' : 'text-green-600'}
          />
        )}
        <StatTile label="Monitored zones" value="5" sub="north · south · east · west · central" />
      </div>

      {/* Incidents + side column */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2" title="Live transit status" action={<LiveBadge />}>
          <TransitStatus />
        </Card>

        {isAuthenticated ? (
          <Card
            title="Messages"
            action={
              <Link to="/messages" className="text-xs text-meridian-blue hover:underline font-medium">
                {unreadCount > 0 ? `${unreadCount} new` : 'View all'}
              </Link>
            }
          >
            {messages.length === 0 ? (
              <p className="text-slate-500 text-sm py-4 text-center">No messages yet.</p>
            ) : (
              <div className="-my-1">
                {messages.map((m, i) => (
                  <div key={m.id || i} className="py-2.5 border-b border-slate-100 last:border-0">
                    <p className={`text-sm ${m.read ? 'text-slate-700' : 'font-medium text-slate-900'}`}>{m.title || 'Notification'}</p>
                    {m.body && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{m.body}</p>}
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

      {/* Transit map */}
      <Card title="Meridian City transit" bodyClassName="!p-2">
        <div className="rounded-xl overflow-hidden p-2">
          <TransitMap />
        </div>
      </Card>

      {/* Quick actions */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <QuickAction icon="store" title="City store" subtitle="Mugs, tees & more" to="/store" />
        <QuickAction icon="pay" title="Pay bills" subtitle="Tax bills & history" to="/billing" />
        <QuickAction icon="report" title="Report an issue" subtitle="Submit a service request" to="/service-requests/new" />
        <QuickAction icon="list" title="My requests" subtitle="Track your submissions" to="/service-requests" />
        <QuickAction icon="chat" title="Ask Meri" subtitle="City AI assistant" onClick={openChat} />
      </div>
    </div>
  )
}

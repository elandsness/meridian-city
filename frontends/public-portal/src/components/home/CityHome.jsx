import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getServiceRequests } from '../../api/serviceRequests.js'
import { getBills } from '../../api/billing.js'
import { getMessages } from '../../api/messages.js'
import TransitPanel from '../TransitPanel.jsx'
import WeatherTile from '../WeatherTile.jsx'
import NewsTicker from '../NewsTicker.jsx'
import Card from '../../ui/Card.jsx'
import StatTile from '../../ui/StatTile.jsx'
import Button from '../../ui/Button.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { formatCents } from '../../lib/format.js'
import { useConfig } from '../../config/ConfigContext'

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

// The original Meridian City home body (metrics row + transit/messages). Kept as a single
// module so the default (city) home is unchanged; other industries compose their own modules.
export default function CityHome() {
  const { isAuthenticated, user } = useAuth()
  const cfg = useConfig()

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

  const requests = unwrap(reqData, 'items', 'service_requests', 'requests')
  const myOpen = requests.filter((r) => OPEN_STATUSES.has((r.status || '').toLowerCase())).length
  const bills = unwrap(billsData, 'items')
  const balanceCents = bills
    .filter((b) => (b.status || '').toLowerCase() === 'outstanding')
    .reduce((sum, b) => sum + (b.amount_cents || 0), 0)
  const messages = (Array.isArray(messagesData?.messages) ? messagesData.messages : []).slice(0, 4)
  const unreadCount = messagesData?.unread ?? 0

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <WeatherTile />
        {isAuthenticated && <StatTile label="My open requests" value={myOpen} />}
        {isAuthenticated && (
          <StatTile
            label="Balance due"
            value={formatCents(balanceCents)}
            valueClassName={balanceCents > 0 ? 'text-red-600' : 'text-green-600'}
          />
        )}
        <NewsTicker />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2" title={`${cfg.company.name} transit`} action={<LiveBadge />}>
          <TransitPanel />
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
          <Card title={`Join ${cfg.company.name}`}>
            <p className="text-sm text-slate-600">
              Create an account to submit requests, track updates, and access everything{' '}
              {cfg.company.name} has to offer.
            </p>
            <div className="flex gap-2 mt-4">
              <Button to="/register" variant="primary" size="sm">Create account</Button>
              <Button to="/login" variant="outline" size="sm">Log in</Button>
            </div>
          </Card>
        )}
      </div>
    </>
  )
}

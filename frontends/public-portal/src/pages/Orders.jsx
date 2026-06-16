import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getOrders } from '../api/store.js'
import { useAuth } from '../context/AuthContext.jsx'
import Card from '../ui/Card.jsx'
import Badge from '../ui/Badge.jsx'
import Timeline from '../ui/Timeline.jsx'
import { formatCents } from '../lib/format.js'

const STAGES = [
  ['placed', 'Order placed'],
  ['packed', 'Packed'],
  ['shipped', 'Shipped'],
  ['delivered', 'Delivered'],
]

const STATUS_TONE = { placed: 'blue', packed: 'amber', shipped: 'blue', delivered: 'green' }

function buildSteps(status) {
  const s = (status || '').toLowerCase()
  let current = STAGES.findIndex(([k]) => k === s)
  if (current < 0) current = 0
  const delivered = s === 'delivered'
  return STAGES.map(([, label], i) => ({
    label,
    state: i < current || (delivered && i === current) ? 'done' : i === current ? 'current' : 'pending',
  }))
}

function unwrapArray(d) {
  return Array.isArray(d) ? d : d?.items ?? []
}

export default function Orders() {
  const { user } = useAuth()
  const citizenId = user?.id

  const { data, isLoading } = useQuery({
    queryKey: ['orders', citizenId],
    queryFn: () => getOrders(citizenId),
    enabled: !!citizenId,
    refetchInterval: 10000, // watch the lifecycle advance
  })

  const orders = unwrapArray(data)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Your orders</h1>
          <p className="text-slate-500 text-sm mt-1">Track your Meridian City store orders.</p>
        </div>
        <Link to="/store" className="text-sm text-meridian-blue hover:underline font-medium">Back to store</Link>
      </div>

      {isLoading && <p className="text-slate-500">Loading…</p>}

      {!isLoading && orders.length === 0 && (
        <Card>
          <div className="text-center py-8">
            <p className="text-slate-500">You haven't placed any orders yet.</p>
            <div className="mt-4 flex justify-center">
              <Link to="/store" className="text-sm text-meridian-blue hover:underline font-medium">Visit the city store</Link>
            </div>
          </div>
        </Card>
      )}

      {orders.map((order) => (
        <Card key={order.id}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium text-slate-900 font-mono text-sm">{order.id}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {order.item_count} item{order.item_count === 1 ? '' : 's'} · {formatCents(order.total_cents)}
                  </div>
                </div>
                <Badge tone={STATUS_TONE[(order.status || '').toLowerCase()] || 'slate'}>{order.status}</Badge>
              </div>
              <div className="mt-3 space-y-1">
                {(order.items || []).map((it) => (
                  <div key={it.product_id} className="flex justify-between text-sm text-slate-600">
                    <span>{it.product_name} × {it.quantity}</span>
                    <span>{formatCents(it.unit_price_cents * it.quantity)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="lg:border-l lg:border-slate-100 lg:pl-6">
              <Timeline steps={buildSteps(order.status)} />
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}

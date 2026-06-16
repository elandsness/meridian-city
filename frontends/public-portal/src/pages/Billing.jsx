import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getBills, payBill } from '../api/billing.js'
import { useAuth } from '../context/AuthContext.jsx'
import Card from '../ui/Card.jsx'
import Button from '../ui/Button.jsx'
import Badge from '../ui/Badge.jsx'
import { formatCents } from '../lib/format.js'
import { startAction, addActionProperties, endAction, reportError } from '../lib/rum.js'

function formatDate(ts) {
  if (!ts) return '—'
  try {
    return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return ts
  }
}

function unwrapArray(d) {
  return Array.isArray(d) ? d : d?.items ?? []
}

export default function Billing() {
  const { user } = useAuth()
  const citizenId = user?.id
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['bills', citizenId],
    queryFn: () => getBills(citizenId),
    enabled: !!citizenId,
    refetchInterval: 30000,
  })

  const payMut = useMutation({
    mutationFn: (billId) => {
      const h = startAction('tax.pay')
      addActionProperties(h, { 'bill.id': billId })
      return payBill(billId).finally(() => endAction(h))
    },
    onError: reportError,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bills', citizenId] }),
  })

  const bills = unwrapArray(data)
  const outstanding = bills.filter((b) => (b.status || '').toLowerCase() === 'outstanding')
  const paid = bills.filter((b) => (b.status || '').toLowerCase() === 'paid')
  const balanceCents = outstanding.reduce((sum, b) => sum + (b.amount_cents || 0), 0)
  const payingId = payMut.isPending ? payMut.variables : null

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tax &amp; billing</h1>
          <p className="text-slate-500 text-sm mt-1">Your quarterly Meridian City tax bills.</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 text-right">
          <div className="text-xs text-slate-500">Balance due</div>
          <div className={`text-2xl font-semibold ${balanceCents > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {formatCents(balanceCents)}
          </div>
        </div>
      </div>

      {isLoading && <p className="text-slate-500">Loading…</p>}

      <Card title="Outstanding">
        {outstanding.length === 0 ? (
          <p className="text-sm text-slate-500 py-2 text-center">You're all paid up. Nice.</p>
        ) : (
          <div className="-my-1">
            {outstanding.map((b) => (
              <div key={b.id} className="flex items-center gap-3 py-3 border-b border-slate-100 last:border-0">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-900">{b.period} tax bill</div>
                  <div className="text-xs text-slate-500">Due {formatDate(b.due_at)}</div>
                </div>
                <span className="text-sm font-medium text-slate-900">{formatCents(b.amount_cents)}</span>
                <Button
                  variant="accent"
                  size="sm"
                  onClick={() => payMut.mutate(b.id)}
                  disabled={payMut.isPending && payingId === b.id}
                >
                  {payMut.isPending && payingId === b.id ? 'Paying…' : 'Pay now'}
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Payment history">
        {paid.length === 0 ? (
          <p className="text-sm text-slate-500 py-2 text-center">No payments yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-100">
                <th className="py-2 font-medium">Period</th>
                <th className="py-2 font-medium">Amount</th>
                <th className="py-2 font-medium">Paid</th>
                <th className="py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {paid.map((b) => (
                <tr key={b.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-2.5 text-slate-900">{b.period}</td>
                  <td className="py-2.5 text-slate-700">{formatCents(b.amount_cents)}</td>
                  <td className="py-2.5 text-slate-500">{formatDate(b.paid_at)}</td>
                  <td className="py-2.5"><Badge tone="green">Paid</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getMessages, markMessageRead, markAllRead } from '../api/messages.js'
import { useAuth } from '../context/AuthContext.jsx'
import Card from '../ui/Card.jsx'
import Button from '../ui/Button.jsx'
import { timeAgo } from '../lib/format.js'

const TYPE_ICON = {
  order_delivered: <path d="M16 16l-4 2-4-2M3 7l9-4 9 4-9 4-9-4zM3 7v10l9 4 9-4V7" />,
  tax_due: <path d="M5 3v18l2-1 2 1 2-1 2 1 2-1 2 1V3l-2 1-2-1-2 1-2-1-2 1-2-1zM9 9h6M9 13h6" />,
  tax_paid: <path d="M20 6L9 17l-5-5" />,
  request_resolved: <path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />,
  info: <path d="M12 16v-4M12 8h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />,
}

function MsgIcon({ type }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {TYPE_ICON[type] || TYPE_ICON.info}
    </svg>
  )
}

function unwrap(d) {
  return Array.isArray(d?.messages) ? d.messages : Array.isArray(d) ? d : d?.items ?? []
}

export default function Messages() {
  const { user } = useAuth()
  const citizenId = user?.id
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['messages', citizenId],
    queryFn: () => getMessages(citizenId),
    enabled: !!citizenId,
    refetchInterval: 15000,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['messages', citizenId] })
  const readMut = useMutation({ mutationFn: markMessageRead, onSuccess: invalidate })
  const readAllMut = useMutation({ mutationFn: () => markAllRead(citizenId), onSuccess: invalidate })

  const messages = unwrap(data)
  const unread = data?.unread ?? messages.filter((m) => !m.read).length

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Messages</h1>
          <p className="text-slate-500 text-sm mt-1">Updates from across Meridian City.</p>
        </div>
        {unread > 0 && (
          <Button variant="outline" size="sm" onClick={() => readAllMut.mutate()} disabled={readAllMut.isPending}>
            Mark all read
          </Button>
        )}
      </div>

      <Card bodyClassName="!p-0">
        {isLoading && <p className="text-slate-500 p-5">Loading…</p>}
        {!isLoading && messages.length === 0 && (
          <p className="text-slate-500 text-center py-10">No messages yet.</p>
        )}
        {messages.map((m) => (
          <button
            key={m.id}
            onClick={() => !m.read && readMut.mutate(m.id)}
            className={`w-full text-left flex gap-3 px-5 py-4 border-b border-slate-100 last:border-0 transition-colors ${
              m.read ? 'hover:bg-slate-50' : 'bg-meridian-tint/40 hover:bg-meridian-tint/60'
            }`}
          >
            <span className={`mt-0.5 ${m.read ? 'text-slate-400' : 'text-meridian-blue'}`}>
              <MsgIcon type={m.type} />
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className={`text-sm ${m.read ? 'text-slate-700' : 'font-medium text-slate-900'}`}>{m.title}</span>
                <span className="text-xs text-slate-400 whitespace-nowrap">{timeAgo(m.created_at)}</span>
              </div>
              {m.body && <p className="text-sm text-slate-500 mt-0.5">{m.body}</p>}
            </div>
            {!m.read && <span className="mt-1.5 w-2 h-2 rounded-full bg-meridian-blue flex-none" aria-label="unread" />}
          </button>
        ))}
      </Card>
    </div>
  )
}

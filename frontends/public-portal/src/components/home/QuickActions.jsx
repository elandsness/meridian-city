import { Link } from 'react-router-dom'
import { useConfig } from '../../config/ConfigContext'
import { useChat } from '../../context/ChatContext.jsx'
import { getActiveScreens } from '../../config/screens.jsx'

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

// Quick-action tiles, gated by which screens the active config enables. Reused by the
// city home bundle and available as a standalone home module for other industries.
export default function QuickActions() {
  const cfg = useConfig()
  const { openChat } = useChat()
  const assistant = cfg.company.assistant.name
  const activeScreens = new Set(getActiveScreens(cfg).map((s) => s.id))
  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
      {activeScreens.has('store') && (
        <QuickAction icon="store" title="City store" subtitle="Mugs, tees & more" to="/store" />
      )}
      {activeScreens.has('billing') && (
        <QuickAction icon="pay" title="Pay bills" subtitle="Tax bills & history" to="/billing" />
      )}
      {activeScreens.has('service-requests') && (
        <QuickAction icon="report" title="Report an issue" subtitle="Submit a request" to="/service-requests/new" />
      )}
      {activeScreens.has('service-requests') && (
        <QuickAction icon="list" title="My requests" subtitle="Track your submissions" to="/service-requests" />
      )}
      <QuickAction icon="chat" title={`Ask ${assistant}`} subtitle="AI assistant" onClick={openChat} />
    </div>
  )
}

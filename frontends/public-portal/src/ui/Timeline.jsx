// Vertical status timeline. Each step: { label, state: 'done'|'current'|'pending', time? }.
// Used for the service-request lifecycle (and later the order lifecycle).
const STATE = {
  done: 'bg-meridian-blue border-meridian-blue',
  current: 'bg-noon-sun border-noon-sun',
  pending: 'bg-white border-slate-300',
}

export default function Timeline({ steps = [] }) {
  return (
    <ol className="relative">
      {steps.map((s, i) => {
        const dot = STATE[s.state] || STATE.pending
        const last = i === steps.length - 1
        return (
          <li key={i} className="flex gap-3 pb-5 last:pb-0 relative">
            {!last && <span className="absolute left-[7px] top-4 bottom-0 w-px bg-slate-200" aria-hidden="true" />}
            <span className={`mt-0.5 w-4 h-4 rounded-full border-2 flex-none ${dot}`} />
            <div className="min-w-0">
              <p className={`text-sm font-medium ${s.state === 'pending' ? 'text-slate-400' : 'text-slate-900'}`}>
                {s.label}
              </p>
              {s.time && <p className="text-xs text-slate-400 mt-0.5">{s.time}</p>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

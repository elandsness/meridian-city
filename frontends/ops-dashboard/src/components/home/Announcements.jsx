import Card from '../../ui/Card.jsx'

const TONE_CLASSES = {
  slate: 'bg-slate-100 text-slate-600',
  blue: 'bg-blue-50 text-blue-700',
  amber: 'bg-amber-50 text-amber-700',
  orange: 'bg-orange-50 text-orange-700',
  green: 'bg-green-50 text-green-700',
  red: 'bg-red-50 text-red-700',
}

// Items accept both plain strings and {title, body, tone} objects.
// Configs authored via the LLM kit typically use plain strings.
export default function Announcements({ items = [], title = 'Announcements' }) {
  return (
    <Card title={title}>
      {items.length === 0 ? (
        <p className="text-slate-500 text-sm text-center py-4">No announcements at this time.</p>
      ) : (
        <div className="overflow-y-auto" style={{ maxHeight: 300 }}>
          <div className="flex flex-col gap-3">
            {items.map((item, i) => {
              const isString = typeof item === 'string'
              const text = isString ? item : item.title
              const body = isString ? null : item.body
              const tone = isString ? null : item.tone
              const toneClass = TONE_CLASSES[tone] ?? TONE_CLASSES.slate
              return (
                <div key={i} className="flex flex-col gap-1 pb-3 border-b border-slate-100 last:border-0 last:pb-0">
                  {tone && (
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${toneClass}`}>{tone}</span>
                      <span className="text-sm font-semibold text-slate-900">{text}</span>
                    </div>
                  )}
                  {!tone && <p className="text-sm text-slate-700 leading-relaxed">{text}</p>}
                  {body && <p className="text-sm text-slate-600 leading-relaxed">{body}</p>}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </Card>
  )
}

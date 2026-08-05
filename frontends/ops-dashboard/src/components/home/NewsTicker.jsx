import { useState, useEffect } from 'react'
import Card from '../../ui/Card.jsx'

function mockTime(offsetMinutes) {
  const d = new Date(Date.now() - offsetMinutes * 60 * 1000)
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
}

export default function NewsTicker({ height = 'slim', items = [] }) {
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    if (height !== 'half' || items.length < 2) return
    const id = setInterval(() => setCurrent((c) => (c + 1) % items.length), 4000)
    return () => clearInterval(id)
  }, [height, items.length])

  if (height === 'slim') {
    const marqueeText = items.join('   •   ')
    return (
      <div className="border-b border-slate-200 bg-slate-50 overflow-hidden flex items-center gap-3" style={{ height: 40 }}>
        <style>{`@keyframes news-marquee { from { transform: translateX(100%) } to { transform: translateX(-100%) } }`}</style>
        <span className="shrink-0 px-3 text-xs font-bold text-slate-500 uppercase tracking-wide border-r border-slate-200 h-full flex items-center">
          📰 LATEST NEWS
        </span>
        <div className="overflow-hidden flex-1 h-full flex items-center">
          <span
            className="whitespace-nowrap text-sm text-slate-700"
            style={{ animation: 'news-marquee 30s linear infinite', display: 'inline-block' }}
          >
            {marqueeText}
          </span>
        </div>
      </div>
    )
  }

  if (height === 'half') {
    return (
      <Card title="News">
        <div className="overflow-y-auto flex flex-col gap-1" style={{ maxHeight: 200 }}>
          {items.map((item, i) => (
            <div
              key={i}
              className={`text-sm px-3 py-2 rounded-lg transition-colors ${
                i === current ? 'bg-blue-50 text-blue-900 font-medium' : 'text-slate-700'
              }`}
            >
              {item}
            </div>
          ))}
        </div>
      </Card>
    )
  }

  return (
    <Card title="News">
      <div className="flex flex-col gap-2">
        {items.map((item, i) => (
          <div key={i} className="flex gap-3 items-start text-sm border-b border-slate-100 last:border-0 pb-2 last:pb-0">
            <span className="shrink-0 text-xs text-slate-400 font-mono pt-0.5">
              {mockTime((items.length - i - 1) * 15 + (120 - items.length * 15))}
            </span>
            <span className="text-slate-700">{item}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}

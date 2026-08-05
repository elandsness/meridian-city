import { useState, useEffect } from 'react'
import Card from '../../ui/Card.jsx'

// Generic scrolling ticker — one component, any content.
//
// Props:
//   items    string[]     Content to display. The authoring LLM writes these from
//                         industry research: stock lines, news headlines, scores,
//                         departure times, commodity prices — any strings work.
//   height   slim|half|full  Default 'slim'.
//   title    string       Card header (half/full modes). Default 'Updates'.
//   label    string       Prefix badge text (slim mode). Default '📡 LIVE'.
//   preset   stocks|sports  Generates plausible placeholder items when `items` is
//                         empty. Seeded by day so output is stable within a day.
//                         Use only as a fallback — real configs should provide items.
//
// Slim  — horizontal CSS-animated marquee bar, ~40px tall.
// Half  — Card with rotating item highlight (cycles every 4s).
// Full  — Card with all items listed.

// ─── Preset generators (day-seeded, stable within a day) ─────────────────────

function dayOfYear() {
  const now = new Date()
  return Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000)
}

const STOCK_SYMBOLS = [
  { s: 'MCI', base: 245 }, { s: 'MRID', base: 87 }, { s: 'MRPB', base: 34 },
  { s: 'MRHG', base: 512 }, { s: 'MRET', base: 28 }, { s: 'MRIN', base: 156 },
]
const SPORT_GAMES = [
  ['City Eagles', 'Riverside Foxes'], ['Metro United', 'Harbor Hawks'],
  ['Northside FC', 'Downtown Athletic'], ['Valley Strikers', 'Eastside United'],
]

function stockPresetItems() {
  const d = dayOfYear()
  return STOCK_SYMBOLS.map(({ s, base }) => {
    const price = base * (1 + (((d * 7 + s.charCodeAt(0)) % 21) / 100) - 0.10)
    const prev  = base * (1 + ((((d - 1) * 7 + s.charCodeAt(0)) % 21) / 100) - 0.10)
    const pct   = ((price - prev) / prev) * 100
    return `${s}  ${price.toFixed(2)}  ${pct >= 0 ? '▲' : '▼'}${Math.abs(pct).toFixed(2)}%`
  })
}

function sportsPresetItems() {
  const d = dayOfYear()
  return SPORT_GAMES.map(([home, away], i) => {
    const g1 = (d + i * 3) % 4
    const g2 = (d + i * 5 + 1) % 3
    return `${home} ${g1}  ·  ${away} ${g2}  FT`
  })
}

function resolveItems(items, preset) {
  if (items && items.length > 0) return items
  if (preset === 'stocks') return stockPresetItems()
  if (preset === 'sports') return sportsPresetItems()
  return []
}

function defaultLabel(preset) {
  if (preset === 'stocks') return '📈 MARKETS'
  if (preset === 'sports') return '⚽ SCORES'
  return '📡 LIVE'
}

// ─── Rendering ───────────────────────────────────────────────────────────────

const MARQUEE_KEYFRAMES = `@keyframes ticker-marquee{from{transform:translateX(100%)}to{transform:translateX(-200%)}}`

export default function Ticker({ items, height = 'slim', title = 'Updates', label, preset }) {
  const resolved = resolveItems(items, preset)
  const prefixLabel = label ?? defaultLabel(preset)
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    if (height !== 'half' || resolved.length < 2) return
    const id = setInterval(() => setCurrent((c) => (c + 1) % resolved.length), 4000)
    return () => clearInterval(id)
  }, [height, resolved.length])

  if (resolved.length === 0) {
    return height === 'slim'
      ? null
      : <Card title={title}><p className="text-sm text-slate-400">No content configured.</p></Card>
  }

  if (height === 'slim') {
    return (
      <div
        className="border-b border-slate-200 bg-slate-50 overflow-hidden flex items-center"
        style={{ height: 40 }}
      >
        <style>{MARQUEE_KEYFRAMES}</style>
        <span className="shrink-0 px-3 text-xs font-bold text-slate-500 uppercase tracking-wide border-r border-slate-200 h-full flex items-center whitespace-nowrap">
          {prefixLabel}
        </span>
        <div className="overflow-hidden flex-1 h-full flex items-center">
          <span
            className="whitespace-nowrap text-sm text-slate-700"
            style={{ animation: 'ticker-marquee 35s linear infinite', display: 'inline-block' }}
          >
            {resolved.join('   ·   ')}
          </span>
        </div>
      </div>
    )
  }

  if (height === 'half') {
    return (
      <Card title={title}>
        <div className="flex flex-col gap-1 overflow-y-auto" style={{ maxHeight: 200 }}>
          {resolved.map((item, i) => (
            <div
              key={i}
              className={`text-sm px-3 py-2 rounded-lg transition-colors ${
                i === current
                  ? 'bg-[rgb(var(--brand)/0.08)] text-slate-900 font-medium'
                  : 'text-slate-600'
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
    <Card title={title}>
      <div className="flex flex-col divide-y divide-slate-100">
        {resolved.map((item, i) => (
          <div key={i} className="py-2 text-sm text-slate-700 first:pt-0 last:pb-0">
            {item}
          </div>
        ))}
      </div>
    </Card>
  )
}

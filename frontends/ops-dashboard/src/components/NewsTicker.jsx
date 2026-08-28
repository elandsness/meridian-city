import { useEffect, useMemo, useState } from 'react'

// Configurable "breaking news" ticker for the ops dashboard.
// Headlines come from the component's `headlines` prop (supplied by the
// PageComposer from the industry config); falls back to a curated set when
// none are provided.

const ROTATE_MS = 90000

const DEFAULT_HEADLINES = [
  "All systems nominal — Meridian ops center reports zero critical alerts",
  "City-wide Wi-Fi upgrade complete; 40% faster speeds across all districts",
  "Annual civic satisfaction survey: Meridian residents rate services 'Excellent'",
  "Traffic flow optimization reduces average commute by 12 minutes",
  "Public transit ridership hits record high; new routes added next month",
  "Water treatment facility passes inspection with top score for third year running",
  "City recycling program diverts 78% of waste from landfill — new target set",
  "Meridian named 'Most Digital-Ready City' in national technology index",
  "Street lighting upgrade cuts energy consumption by 30% across downtown",
  "Community garden initiative produces 2,000 lbs of produce for local food bank",
]

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function NewsTicker({ headlines, config }) {
  const tickerHeadlines = useMemo(
    () => (headlines && headlines.length > 0 ? headlines : DEFAULT_HEADLINES),
    [headlines]
  )
  const order = useMemo(() => shuffle(tickerHeadlines), [tickerHeadlines])
  const [i, setI] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % order.length), ROTATE_MS)
    return () => clearInterval(t)
  }, [order.length])

  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white px-4 py-3 flex flex-col">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          Breaking
        </span>
        <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Ops Updates</span>
      </div>
      <p
        key={i}
        className="animate-ticker-in mt-1.5 text-sm font-medium leading-snug text-slate-900 line-clamp-3"
      >
        {order[i]}
      </p>
      <span
        key={`p-${i}`}
        className="animate-ticker-progress absolute bottom-0 left-0 h-0.5 w-full bg-red-500/70"
        style={{ '--ticker-ms': `${ROTATE_MS}ms` }}
      />
    </div>
  )
}

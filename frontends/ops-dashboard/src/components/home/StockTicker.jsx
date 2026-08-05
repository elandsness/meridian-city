import Card from '../../ui/Card.jsx'

const DEFAULT_SYMBOLS = [
  { symbol: 'MCI', name: 'Meridian City Inc.', basePrice: 245 },
  { symbol: 'MRID', name: 'Meridian Infrastructure', basePrice: 87 },
  { symbol: 'MRPB', name: 'Meridian Public Banking', basePrice: 34 },
  { symbol: 'MRHG', name: 'Meridian Holdings Group', basePrice: 512 },
  { symbol: 'MRET', name: 'Meridian Energy Trust', basePrice: 28 },
]

function getDayOfYear() {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 0)
  return Math.floor((now - start) / 86400000)
}

function calcPrice(basePrice, symbol, dayOffset = 0) {
  const dayOfYear = getDayOfYear() + dayOffset
  return basePrice * (1 + (((dayOfYear * 7 + symbol.charCodeAt(0)) % 21) / 100) - 0.1)
}

function computeStocks(symbols) {
  return symbols.map((s) => {
    const price = calcPrice(s.basePrice, s.symbol, 0)
    const prev = calcPrice(s.basePrice, s.symbol, -1)
    const change = ((price - prev) / prev) * 100
    return { ...s, price, change }
  })
}

function ChangeLabel({ change }) {
  const sign = change >= 0 ? '+' : ''
  return (
    <span className={change >= 0 ? 'text-green-600' : 'text-red-600'}>
      {sign}{change.toFixed(2)}%
    </span>
  )
}

function MiniSparkline({ change }) {
  const heights = [40, 55, 35, 70, change >= 0 ? 90 : 20]
  return (
    <div className="flex items-end gap-0.5 h-6">
      {heights.map((h, i) => (
        <div
          key={i}
          className={`w-1.5 rounded-sm ${change >= 0 ? 'bg-green-400' : 'bg-red-400'}`}
          style={{ height: `${h}%` }}
        />
      ))}
    </div>
  )
}

export default function StockTicker({ height = 'slim', symbols }) {
  const stocks = computeStocks(symbols ?? DEFAULT_SYMBOLS)

  if (height === 'slim') {
    const marqueeText = stocks
      .map((s) => `${s.symbol} $${s.price.toFixed(2)} ${s.change >= 0 ? '▲' : '▼'}${Math.abs(s.change).toFixed(2)}%`)
      .join('   •   ')

    return (
      <div className="border-b border-slate-200 bg-slate-50 overflow-hidden flex items-center gap-3" style={{ height: 40 }}>
        <style>{`@keyframes stock-marquee { from { transform: translateX(100%) } to { transform: translateX(-100%) } }`}</style>
        <span className="shrink-0 px-3 text-xs font-bold text-slate-500 uppercase tracking-wide border-r border-slate-200 h-full flex items-center">
          📈 MARKETS
        </span>
        <div className="overflow-hidden flex-1 h-full flex items-center">
          <span
            className="whitespace-nowrap text-sm text-slate-700"
            style={{ animation: 'stock-marquee 25s linear infinite', display: 'inline-block' }}
          >
            {marqueeText}
          </span>
        </div>
      </div>
    )
  }

  if (height === 'half') {
    return (
      <Card title="Markets">
        <div className="flex flex-col gap-2">
          {stocks.map((s) => (
            <div key={s.symbol} className="flex items-center justify-between text-sm">
              <span className="font-medium text-slate-800 w-14">{s.symbol}</span>
              <span className="text-slate-600 flex-1">${s.price.toFixed(2)}</span>
              <ChangeLabel change={s.change} />
            </div>
          ))}
        </div>
      </Card>
    )
  }

  return (
    <Card title="Markets">
      <div className="flex flex-col gap-3">
        {stocks.map((s) => (
          <div key={s.symbol} className="flex items-center gap-3">
            <div className="w-12 shrink-0">
              <div className="text-xs font-bold text-slate-800">{s.symbol}</div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-slate-500 truncate">{s.name}</div>
            </div>
            <div className="text-sm font-medium text-slate-800 w-20 text-right">
              ${s.price.toFixed(2)}
            </div>
            <div className="w-14 text-right text-sm">
              <ChangeLabel change={s.change} />
            </div>
            <MiniSparkline change={s.change} />
          </div>
        ))}
      </div>
    </Card>
  )
}

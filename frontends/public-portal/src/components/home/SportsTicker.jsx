import Card from '../../ui/Card.jsx'

const TEAMS = [
  ['City Eagles', 'Riverside Foxes'],
  ['Metro United', 'Harbor Hawks'],
  ['Northside FC', 'Downtown Athletic'],
  ['Valley Strikers', 'Eastside United'],
  ['Central Lions', 'Westport City'],
  ['Lakeside FC', 'Highland Rangers'],
  ['Bay City Rovers', 'Meridian FC'],
  ['Uptown Athletic', 'Bayside United'],
]

const SPORT_ICONS = { soccer: '⚽', football: '🏈', basketball: '🏀', baseball: '⚾', hockey: '🏒' }

function getDayOfYear() {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 0)
  return Math.floor((now - start) / 86400000)
}

function buildGames() {
  const dayOfYear = getDayOfYear()
  return TEAMS.map(([home, away], i) => {
    const seed = dayOfYear + i
    const homeScore = seed % 4
    const awayScore = (seed * 3 + i) % 4
    let status
    if (i === 2) status = `LIVE 72'`
    else if (i === 3 || i === 4) status = 'HT'
    else status = 'FT'
    return { home, away, homeScore, awayScore, status }
  })
}

export default function SportsTicker({ height = 'slim', sport = 'Soccer', league }) {
  const games = buildGames()
  const sportKey = sport.toLowerCase()
  const icon = SPORT_ICONS[sportKey] ?? '🏟️'
  const leagueLabel = league ?? `${sport} League`

  if (height === 'slim') {
    const marqueeText = games
      .map((g) => `${g.home} ${g.homeScore} - ${g.awayScore} ${g.away} (${g.status})`)
      .join('   •   ')

    return (
      <div className="border-b border-slate-200 bg-slate-50 overflow-hidden flex items-center gap-3" style={{ height: 40 }}>
        <style>{`@keyframes sports-marquee { from { transform: translateX(100%) } to { transform: translateX(-100%) } }`}</style>
        <span className="shrink-0 px-3 text-xs font-bold text-slate-500 uppercase tracking-wide border-r border-slate-200 h-full flex items-center whitespace-nowrap">
          {icon} {leagueLabel}
        </span>
        <div className="overflow-hidden flex-1 h-full flex items-center">
          <span
            className="whitespace-nowrap text-sm text-slate-700"
            style={{ animation: 'sports-marquee 35s linear infinite', display: 'inline-block' }}
          >
            {marqueeText}
          </span>
        </div>
      </div>
    )
  }

  const rows = (
    <div className="flex flex-col gap-2">
      {games.map((g, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <span
            className={`shrink-0 text-xs font-semibold px-1.5 py-0.5 rounded ${
              g.status.startsWith('LIVE')
                ? 'bg-red-100 text-red-600'
                : g.status === 'HT'
                ? 'bg-amber-100 text-amber-700'
                : 'bg-slate-100 text-slate-500'
            }`}
          >
            {g.status}
          </span>
          <span className="flex-1 text-slate-700 truncate">{g.home}</span>
          <span className="font-bold text-slate-900 tabular-nums">{g.homeScore} - {g.awayScore}</span>
          <span className="flex-1 text-slate-700 truncate text-right">{g.away}</span>
        </div>
      ))}
    </div>
  )

  return <Card title={`${icon} ${sport}`}>{rows}</Card>
}

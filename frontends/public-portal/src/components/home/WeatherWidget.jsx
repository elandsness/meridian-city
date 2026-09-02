import Card from '../../ui/Card.jsx'

const CONDITIONS = ['☀️ Sunny', '⛅ Partly Cloudy', '🌤 Mostly Clear', '🌦 Showers', '🌧 Rainy', '⛈ Thunderstorms', '🌫 Foggy']

const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function getDayOfYear(d) {
  const start = new Date(d.getFullYear(), 0, 0)
  return Math.floor((d - start) / 86400000)
}

function getForecastDay(offsetDays) {
  const now = new Date()
  const year = now.getFullYear()
  const dayOfYear = getDayOfYear(now)
  const seed = year * 366 + dayOfYear + offsetDays
  const condIdx = seed % CONDITIONS.length
  const temp = 55 + ((seed * 7) % 36)
  const d = new Date(now)
  d.setDate(d.getDate() + offsetDays)
  return {
    day: offsetDays === 0 ? 'Today' : DAY_ABBR[d.getDay()],
    condition: CONDITIONS[condIdx],
    temp,
  }
}

export default function WeatherWidget({ mode = 'perfect' }) {
  if (mode === 'perfect') {
    return (
      <Card title="Weather">
        <div className="flex items-center gap-4">
          <span className="text-5xl">☀️</span>
          <div>
            <div className="text-3xl font-bold text-slate-900">75°F</div>
            <div className="text-sm text-slate-600">Sunny</div>
            <div className="text-xs text-slate-500 mt-1">Light breeze · Humidity 45%</div>
          </div>
        </div>
      </Card>
    )
  }

  const forecast = [0, 1, 2, 3].map(getForecastDay)

  return (
    <Card title="4-Day Forecast">
      <div className="grid grid-cols-4 gap-2 text-center">
        {forecast.map((day) => {
          const icon = day.condition.split(' ')[0]
          return (
            <div key={day.day} className="flex flex-col items-center gap-1">
              <span className="text-xs font-medium text-slate-500">{day.day}</span>
              <span className="text-2xl">{icon}</span>
              <span className="text-sm font-semibold text-slate-800">{day.temp}°</span>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

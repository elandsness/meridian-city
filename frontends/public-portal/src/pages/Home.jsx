import { useAuth } from '../context/AuthContext.jsx'
import { displayName, greeting } from '../lib/format.js'
import { useConfig } from '../config/ConfigContext'
import Button from '../ui/Button.jsx'
import { getActiveHomeModules } from '../config/homeModules.jsx'

// Home is a hero shell + a config-selected list of home modules (see homeModules.jsx).
// The default (city) config renders the original home bundle; the airport config swaps in
// flight status, the airfield map, and the journey tracker.
export default function Home() {
  const { isAuthenticated, user } = useAuth()
  const cfg = useConfig()
  const modules = getActiveHomeModules(cfg)

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {isAuthenticated ? `${greeting()}, ${displayName(user)}` : `Welcome to ${cfg.company.name}`}
          </h1>
          <p className="text-slate-500 mt-1">Here's what's happening across {cfg.company.name} today.</p>
        </div>
        {!isAuthenticated && (
          <div className="flex gap-2">
            <Button to="/login" variant="primary">Log in</Button>
            <Button to="/register" variant="outline">Register</Button>
          </div>
        )}
      </section>

      {modules.map(({ id, Component }) => (
        <Component key={id} />
      ))}
    </div>
  )
}

import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import NotificationBell from './NotificationBell.jsx'
import ChatWidget from './ChatWidget.jsx'

function BrandSun() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#412402" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19" />
    </svg>
  )
}

function initials(user) {
  const src = user?.name || user?.username || ''
  const parts = src.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase()
}

const navLinkClass = ({ isActive }) =>
  `text-sm pb-1 border-b-2 transition-colors ${
    isActive ? 'text-white border-noon-sun' : 'text-white/75 border-transparent hover:text-white'
  }`

export default function Layout() {
  const { isAuthenticated, user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <nav className="bg-meridian-blue sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-noon-sun flex items-center justify-center">
              <BrandSun />
            </span>
            <span className="text-base font-semibold text-white tracking-tight">Meridian City</span>
          </Link>

          <div className="hidden md:flex items-center gap-5">
            <NavLink to="/" end className={navLinkClass}>Home</NavLink>
            <NavLink to="/service-requests" className={navLinkClass}>Service requests</NavLink>
            <NavLink to="/store" className={navLinkClass}>City store</NavLink>
            <NavLink to="/billing" className={navLinkClass}>Pay bills</NavLink>
          </div>

          <div className="ml-auto flex items-center gap-3">
            {isAuthenticated && <NotificationBell />}
            {isAuthenticated ? (
              <>
                <span
                  className="w-8 h-8 rounded-full bg-noon-sun text-noon-ink flex items-center justify-center text-xs font-semibold"
                  title={user?.username || ''}
                >
                  {initials(user)}
                </span>
                <button
                  onClick={handleLogout}
                  className="bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                >
                  Logout
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="bg-noon-sun hover:bg-noon-sun-soft text-noon-ink px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
              >
                Log in
              </Link>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <Outlet />
      </main>

      {/* Persistent across all routes; opens via the floating button or a quick action. */}
      <ChatWidget />
    </div>
  )
}

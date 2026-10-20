import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useConfig } from '../config/ConfigContext.jsx'
import Card from '../ui/Card.jsx'
import Button from '../ui/Button.jsx'
import Badge from '../ui/Badge.jsx'

function initials(user) {
  const src = user?.name || user?.username || ''
  const parts = src.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase()
}

export default function MyAccount() {
  const { user, logout } = useAuth()
  const cfg = useConfig()
  const navigate = useNavigate()

  // Only a citizen login carries an id/name (see docs/API_CONVENTIONS.md); the
  // demo operator login has neither, so fall back to a generic label for it.
  const isOperator = user?.role === 'operator'
  const roleLabel = isOperator ? 'Demo Operator' : (cfg.terminology?.customer ?? 'Account')
  const name = user?.name || (isOperator ? 'Demo Operator' : user?.username)

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Account</h1>
        <p className="text-slate-500 text-sm mt-1">Your account details for {cfg.company.name}.</p>
      </div>

      <Card>
        <div className="flex items-center gap-4">
          <span className="w-14 h-14 rounded-full bg-noon-sun text-noon-ink flex items-center justify-center text-lg font-semibold shrink-0">
            {initials(user)}
          </span>
          <div className="min-w-0">
            <div className="text-lg font-semibold text-slate-900 truncate">{name}</div>
            {user?.username && <div className="text-sm text-slate-500 truncate">{user.username}</div>}
          </div>
          <Badge tone="blue" className="ml-auto shrink-0">{roleLabel}</Badge>
        </div>

        <dl className="mt-6 divide-y divide-slate-100 border-t border-slate-100">
          {user?.id && (
            <div className="flex justify-between py-3 text-sm">
              <dt className="text-slate-500">Account ID</dt>
              <dd className="text-slate-900 font-medium">{user.id}</dd>
            </div>
          )}
          <div className="flex justify-between py-3 text-sm">
            <dt className="text-slate-500">Email</dt>
            <dd className="text-slate-900 font-medium">{user?.username || '—'}</dd>
          </div>
          <div className="flex justify-between py-3 text-sm">
            <dt className="text-slate-500">Role</dt>
            <dd className="text-slate-900 font-medium">{roleLabel}</dd>
          </div>
        </dl>

        <div className="mt-6 flex justify-end">
          <Button variant="outline" size="sm" onClick={handleLogout}>Log out</Button>
        </div>
      </Card>
    </div>
  )
}

import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import AuthShell from '../components/AuthShell.jsx'
import Button from '../ui/Button.jsx'
import { inputClass, labelClass } from '../ui/form.js'
import { useConfig } from '../config/ConfigContext'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const cfg = useConfig()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(username, password)
      navigate('/')
    } catch (err) {
      setError(
        err.response?.data?.message || err.response?.data?.error || 'Invalid credentials. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell title="Welcome back" subtitle={`Sign in to your ${cfg.company.name} account`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelClass}>Email or username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoFocus
            className={inputClass}
            placeholder="your@email.com"
          />
        </div>

        <div>
          <label className={labelClass}>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className={inputClass}
            placeholder="Enter password"
          />
        </div>

        {error && (
          <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        )}

        <Button type="submit" variant="primary" disabled={loading} className="w-full">
          {loading ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      <div className="mt-6 space-y-3">
        <p className="text-center text-sm text-slate-500">
          Don't have an account?{' '}
          <Link to="/register" className="text-meridian-blue hover:underline font-medium">Register</Link>
        </p>
        <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-xs text-slate-500 text-center space-y-1">
          <p>
            Registered? Sign in with your <span className="text-slate-700">email</span> and password.
          </p>
          <p>
            Demo operator: <span className="font-mono text-slate-700">demo</span> /{' '}
            <span className="font-mono text-slate-700">dynatrace</span>
          </p>
        </div>
      </div>
    </AuthShell>
  )
}

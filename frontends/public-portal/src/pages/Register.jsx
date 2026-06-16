import { useState } from 'react'
import { Link } from 'react-router-dom'
import client from '../api/client.js'
import AuthShell from '../components/AuthShell.jsx'
import Button from '../ui/Button.jsx'
import { inputClass, labelClass } from '../ui/form.js'

export default function Register() {
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', address: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    // citizen-service expects { first_name, last_name, email, zone_id, password }
    // (snake_case via the global Jackson strategy). There is no phone field; the
    // optional address maps onto zone_id. password creates a login account so the
    // citizen can sign in afterward (email + password).
    const payload = {
      first_name: form.firstName,
      last_name: form.lastName,
      email: form.email,
      password: form.password,
    }
    if (form.address) payload.zone_id = form.address

    try {
      await client.post('/api/v1/citizens', payload)
      setSuccess(true)
    } catch (err) {
      setError(
        err.response?.data?.message || err.response?.data?.error || 'Registration failed. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell title="Create account" subtitle="Join Meridian City">
      {success ? (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
            <p className="text-green-700 font-semibold">Account created</p>
            <p className="text-slate-600 text-sm mt-1">You can now sign in with your email and password.</p>
          </div>
          <Button to="/login" variant="primary" className="w-full">Go to sign in</Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>First name</label>
              <input type="text" name="firstName" value={form.firstName} onChange={handleChange} required className={inputClass} placeholder="Jane" />
            </div>
            <div>
              <label className={labelClass}>Last name</label>
              <input type="text" name="lastName" value={form.lastName} onChange={handleChange} required className={inputClass} placeholder="Smith" />
            </div>
          </div>

          <div>
            <label className={labelClass}>Email</label>
            <input type="email" name="email" value={form.email} onChange={handleChange} required className={inputClass} placeholder="jane@example.com" />
          </div>

          <div>
            <label className={labelClass}>Password</label>
            <input type="password" name="password" value={form.password} onChange={handleChange} required minLength={6} className={inputClass} placeholder="Choose a password" />
            <p className="text-xs text-slate-500 mt-1">You'll sign in with your email and this password.</p>
          </div>

          <div>
            <label className={labelClass}>
              Address <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <input type="text" name="address" value={form.address} onChange={handleChange} maxLength={50} className={inputClass} placeholder="123 Main St, Meridian City" />
          </div>

          {error && (
            <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}

          <Button type="submit" variant="primary" disabled={loading} className="w-full">
            {loading ? 'Creating account…' : 'Create account'}
          </Button>

          <p className="text-center text-sm text-slate-500">
            Already have an account?{' '}
            <Link to="/login" className="text-meridian-blue hover:underline font-medium">Sign in</Link>
          </p>
        </form>
      )}
    </AuthShell>
  )
}

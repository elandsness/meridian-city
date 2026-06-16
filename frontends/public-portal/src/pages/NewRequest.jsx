import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { createServiceRequest } from '../api/serviceRequests.js'
import Card from '../ui/Card.jsx'
import Button from '../ui/Button.jsx'
import { inputClass, labelClass } from '../ui/form.js'

const CATEGORIES = ['infrastructure', 'utilities', 'safety', 'environment', 'transport', 'other']
const PRIORITIES = ['low', 'normal', 'high', 'urgent']

export default function NewRequest() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    category: 'infrastructure',
    title: '',
    description: '',
    priority: 'normal',
    location: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    // Citizen login now mints a real citizen id (user.id === citizen_id). Fall
    // back to a seeded citizen only for the anonymous/operator case.
    const { location, ...rest } = form
    const payload = {
      ...rest,
      citizen_id: user?.id ?? 'cit-00001',
    }
    // citizen-service has no free-text location field; map it onto the optional
    // zone_id. Keep it omitted when blank.
    if (location) payload.zone_id = location

    try {
      await createServiceRequest(payload)
      navigate('/service-requests', { state: { success: true } })
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          'Failed to submit request. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/service-requests" className="text-slate-500 hover:text-slate-900 transition-colors text-sm">
          ← Back
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Submit a request</h1>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className={labelClass}>Category</label>
            <select name="category" value={form.category} onChange={handleChange} required className={inputClass}>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Title</label>
            <input
              type="text"
              name="title"
              value={form.title}
              onChange={handleChange}
              required
              maxLength={200}
              className={inputClass}
              placeholder="Brief description of the issue"
            />
          </div>

          <div>
            <label className={labelClass}>Description</label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              required
              rows={4}
              className={inputClass + ' resize-none'}
              placeholder="Provide more details about the issue…"
            />
          </div>

          <div>
            <label className={labelClass}>Priority</label>
            <select name="priority" value={form.priority} onChange={handleChange} required className={inputClass}>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>
              Location <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              name="location"
              value={form.location}
              onChange={handleChange}
              maxLength={50}
              className={inputClass}
              placeholder="e.g. 123 Main St or intersection of Oak Ave & 5th"
            />
          </div>

          {error && (
            <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <Button type="submit" variant="primary" disabled={loading} className="flex-1">
              {loading ? 'Submitting…' : 'Submit request'}
            </Button>
            <Button to="/service-requests" variant="outline">Cancel</Button>
          </div>
        </form>
      </Card>
    </div>
  )
}

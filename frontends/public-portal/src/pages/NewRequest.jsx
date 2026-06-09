import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { createServiceRequest } from '../api/serviceRequests.js'

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

    // The public portal has no per-citizen identity — the gateway's local
    // /auth/login returns only { username, role }, so user.id is undefined.
    // Fall back to a seeded citizen (the seed creates cit-00001..cit-00050).
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

  const inputClass =
    'w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500'

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/service-requests" className="text-slate-400 hover:text-white transition-colors text-sm">
          ← Back
        </Link>
        <h1 className="text-2xl font-bold text-white">Submit New Request</h1>
      </div>

      <div className="bg-slate-800 rounded-2xl p-6 shadow-xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Category</label>
            <select
              name="category"
              value={form.category}
              onChange={handleChange}
              required
              className={inputClass}
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat} className="capitalize">
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Title</label>
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
            <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              required
              rows={4}
              className={inputClass + ' resize-none'}
              placeholder="Provide more details about the issue..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Priority</label>
            <select
              name="priority"
              value={form.priority}
              onChange={handleChange}
              required
              className={inputClass}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p} className="capitalize">
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Location <span className="text-slate-500 font-normal">(optional)</span>
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
            <p className="text-red-400 text-sm bg-red-900/30 border border-red-800 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg transition-colors"
            >
              {loading ? 'Submitting...' : 'Submit Request'}
            </button>
            <Link
              to="/service-requests"
              className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm font-medium transition-colors text-center"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}

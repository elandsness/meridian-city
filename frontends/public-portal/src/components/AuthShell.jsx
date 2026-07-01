import { Link } from 'react-router-dom'
import BrandMark from './BrandMark.jsx'
import { useConfig } from '../config/ConfigContext'

// Centered, brand-marked container for the login / register screens.
export default function AuthShell({ title, subtitle, children }) {
  const cfg = useConfig()
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center justify-center gap-2.5 mb-6">
          <BrandMark className="w-10 h-10" />
          <span className="text-lg font-semibold text-slate-900">{cfg.company.name}</span>
        </Link>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
          <div className="text-center mb-6">
            <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
            {subtitle && <p className="text-slate-500 mt-1 text-sm">{subtitle}</p>}
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}

import { Link } from 'react-router-dom'

function BrandSun() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#412402" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19" />
    </svg>
  )
}

// Centered, brand-marked container for the login / register screens.
export default function AuthShell({ title, subtitle, children }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center justify-center gap-2.5 mb-6">
          <span className="w-9 h-9 rounded-lg bg-noon-sun flex items-center justify-center">
            <BrandSun />
          </span>
          <span className="text-lg font-semibold text-slate-900">Meridian City</span>
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

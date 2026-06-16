import { Link } from 'react-router-dom'

const BASE =
  'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed'

const VARIANTS = {
  primary: 'bg-meridian-blue text-white hover:bg-meridian-blue-deep',
  accent: 'bg-noon-sun text-noon-ink hover:bg-noon-sun-soft',
  outline: 'border border-slate-300 text-slate-700 hover:bg-slate-50',
  ghost: 'text-slate-600 hover:bg-slate-100',
}

const SIZES = {
  sm: 'text-sm px-3 py-1.5',
  md: 'text-sm px-4 py-2',
  lg: 'text-base px-5 py-2.5',
}

// Renders a <Link> when `to` is set, an <a> when `href` is set, else a <button>.
export default function Button({ variant = 'primary', size = 'md', to, href, className = '', children, ...props }) {
  const cls = `${BASE} ${VARIANTS[variant] || VARIANTS.primary} ${SIZES[size] || SIZES.md} ${className}`
  if (to) return <Link to={to} className={cls} {...props}>{children}</Link>
  if (href) return <a href={href} className={cls} {...props}>{children}</a>
  return <button className={cls} {...props}>{children}</button>
}

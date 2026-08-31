// Pill badge. `tone` selects a light fill + same-family dark text. Used for
// incident severity and request/order status across the portal.
const TONES = {
  slate: 'bg-slate-800 text-slate-200',
  blue: 'bg-blue-900 text-blue-200',
  amber: 'bg-amber-900 text-amber-200',
  orange: 'bg-orange-900 text-orange-200',
  green: 'bg-green-900 text-green-200',
  red: 'bg-red-900 text-red-200',
}

export default function Badge({ tone = 'slate', className = '', children }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${TONES[tone] || TONES.slate} ${className}`}
    >
      {children}
    </span>
  )
}

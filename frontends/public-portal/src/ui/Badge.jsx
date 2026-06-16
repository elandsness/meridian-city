// Pill badge. `tone` selects a light fill + same-family dark text. Used for
// incident severity and request/order status across the portal.
const TONES = {
  slate: 'bg-slate-100 text-slate-700',
  blue: 'bg-meridian-tint text-meridian-blue',
  amber: 'bg-amber-100 text-amber-800',
  orange: 'bg-orange-100 text-orange-700',
  green: 'bg-green-100 text-green-700',
  red: 'bg-red-100 text-red-700',
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

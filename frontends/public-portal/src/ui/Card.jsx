// Branded surface card. Optional header (title + action), white surface, soft
// border — the building block for the citizen dashboard.
export default function Card({ title, action, className = '', bodyClassName = '', children }) {
  const hasHeader = title || action
  return (
    <div className={`bg-white rounded-2xl border border-slate-200 ${className}`}>
      {hasHeader && (
        <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3 border-b border-slate-100">
          {title ? <h2 className="text-base font-semibold text-slate-900">{title}</h2> : <span />}
          {action}
        </div>
      )}
      <div className={`p-5 ${bodyClassName}`}>{children}</div>
    </div>
  )
}

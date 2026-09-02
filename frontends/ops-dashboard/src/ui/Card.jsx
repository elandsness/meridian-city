// Dark-themed surface card for the ops dashboard. Same API as the public-portal
// Card so shared home modules can be imported without prop changes.
export default function Card({ title, action, className = '', bodyClassName = '', children }) {
  const hasHeader = title || action
  return (
    <div className={`bg-gray-800 rounded-xl border border-gray-700 ${className}`}>
      {hasHeader && (
        <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3 border-b border-gray-700">
          {title ? (
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">{title}</h2>
          ) : (
            <span />
          )}
          {action}
        </div>
      )}
      <div className={`p-5 ${bodyClassName}`}>{children}</div>
    </div>
  )
}

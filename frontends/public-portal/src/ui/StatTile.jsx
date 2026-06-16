// Compact metric tile — small label over a large value, optional sub-line.
export default function StatTile({ label, value, sub, valueClassName = 'text-slate-900' }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 px-4 py-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-2xl font-semibold mt-0.5 ${valueClassName}`}>{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-0.5 truncate">{sub}</div>}
    </div>
  )
}

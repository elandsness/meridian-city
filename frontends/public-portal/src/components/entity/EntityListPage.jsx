import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useConfig } from '../../config/ConfigContext.jsx'
import { getEntities, unwrapEntities } from '../../api/entities.js'
import { getEntityDef, getStateMeta, toneBadgeClass } from './entityConfig.js'
import Card from '../../ui/Card.jsx'

// Generic `entity-list` screen template: renders ANY entity type as a table,
// driven entirely by its config (fields to show, state->tone/label, optional
// filter tabs) -- no entity-type-specific code. Generalizes ServiceRequests.jsx/
// IncidentsPage.jsx/IoTPage.jsx's shared shape.
export default function EntityListPage({ entityType, fields, filters }) {
  const config = useConfig()
  const navigate = useNavigate()
  const def = getEntityDef(config, entityType)
  const [activeFilter, setActiveFilter] = useState(null)

  const { data, isError, isLoading } = useQuery({
    queryKey: ['entities', entityType],
    queryFn: () => getEntities(entityType),
    refetchInterval: 10000,
  })
  const rows = unwrapEntities(data)

  const filtered = useMemo(() => {
    if (!activeFilter || !filters) return rows
    const f = filters.find((x) => x.id === activeFilter)
    if (!f?.match) return rows
    return rows.filter((r) => matches(r, f.match))
  }, [rows, activeFilter, filters])

  const columns = fields && fields.length > 0 ? fields : Object.keys(def?.fields ?? {})

  return (
    <Card title={def?.displayNamePlural ?? entityType}>
      {filters && filters.length > 0 && (
        <div className="flex gap-2 mb-4">
          <FilterTab label="All" active={!activeFilter} onClick={() => setActiveFilter(null)} />
          {filters.map((f) => (
            <FilterTab key={f.id} label={f.label} active={activeFilter === f.id} onClick={() => setActiveFilter(f.id)} />
          ))}
        </div>
      )}
      {isLoading ? (
        <p className="text-sm text-slate-400 py-6 text-center">Loading…</p>
      ) : isError ? (
        <p className="text-sm text-slate-400 py-6 text-center">Unable to load right now.</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-slate-400 py-6 text-center">Nothing here yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-100">
                {columns.map((c) => (
                  <th key={c} className="py-2 pr-4 font-medium">{c.replace(/_/g, ' ')}</th>
                ))}
                <th className="py-2 pr-4 font-medium">state</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const meta = getStateMeta(def, row.state)
                return (
                  <tr
                    key={row.id}
                    className="border-b border-slate-50 last:border-0 hover:bg-slate-50 cursor-pointer"
                    onClick={() => navigate(`/entities/${entityType}/${row.id}`)}
                  >
                    {columns.map((c) => (
                      <td key={c} className="py-2.5 pr-4 text-slate-700">{formatValue(row[c])}</td>
                    ))}
                    <td className="py-2.5 pr-4">
                      <span className={`text-xs px-2 py-1 rounded ${toneBadgeClass(meta.tone)}`}>
                        {meta.label ?? row.state}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

function FilterTab({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-3 py-1.5 rounded-full border ${
        active ? 'bg-meridian-blue text-white border-transparent' : 'border-slate-200 text-slate-500'
      }`}
    >
      {label}
    </button>
  )
}

function matches(row, match) {
  if (match.field && 'in' in match) return match.in.includes(row[match.field])
  if (match.field && 'equals' in match) return row[match.field] === match.equals
  return true
}

function formatValue(v) {
  if (v == null) return '—'
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  return String(v)
}

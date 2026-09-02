import { useParams } from 'react-router-dom'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { useConfig } from '../../config/ConfigContext.jsx'
import { getEntity, runEntityAction } from '../../api/entities.js'
import { getEntityDef, getStateOrder } from './entityConfig.js'
import Card from '../../ui/Card.jsx'
import Timeline from '../../ui/Timeline.jsx'

// Generic `entity-detail` screen template: header + field grid + a timeline
// built directly from the entity type's ordered `states` (generalizing
// RequestDetail.jsx's hardcoded STAGES / MyJourney.jsx's hardcoded ORDER into
// one config-declared ordering) + optional transition action buttons.
//
// `entityType` is optional: falls back to the `:entityType` URL param so this
// same component also serves the one generic detail route
// (/entities/:entityType/:id, registered once in App.jsx) that every
// entity-list row links to -- no per-industry detail-screen config needed.
export default function EntityDetailPage({ entityType: entityTypeProp, fields }) {
  const { id, entityType: entityTypeParam } = useParams()
  const entityType = entityTypeProp ?? entityTypeParam
  const config = useConfig()
  const queryClient = useQueryClient()
  const def = getEntityDef(config, entityType)

  const { data: entity, isLoading, isError } = useQuery({
    queryKey: ['entity', entityType, id],
    queryFn: () => getEntity(entityType, id),
    refetchInterval: 8000,
  })

  const actionMutation = useMutation({
    mutationFn: (action) => runEntityAction(entityType, id, action),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['entity', entityType, id] }),
  })

  if (isLoading) return <p className="text-sm text-slate-400 py-6 text-center">Loading…</p>
  if (isError || !entity) return <p className="text-sm text-slate-400 py-6 text-center">Not found.</p>

  const order = getStateOrder(def)
  const currentIndex = order.indexOf(entity.state)
  const steps = order
    .filter((s) => !def.states[s]?.isError || s === entity.state)
    .map((s) => ({
      label: def.states[s]?.label ?? s,
      state: order.indexOf(s) < currentIndex ? 'done' : order.indexOf(s) === currentIndex ? 'current' : 'pending',
    }))

  const columns = fields && fields.length > 0 ? fields : Object.keys(def?.fields ?? {})
  const actions = (def?.transitions ?? []).filter((t) => t.userTriggerable && t.from === entity.state)

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card title={def?.displayName ?? entityType} className="md:col-span-2">
        <dl className="grid grid-cols-2 gap-4">
          {columns.map((c) => (
            <div key={c}>
              <dt className="text-xs text-slate-400 uppercase tracking-wide">{c.replace(/_/g, ' ')}</dt>
              <dd className="text-sm text-slate-800 mt-0.5">{formatValue(entity[c])}</dd>
            </div>
          ))}
        </dl>
        {actions.length > 0 && (
          <div className="flex gap-2 mt-6 pt-4 border-t border-slate-100">
            {actions.map((a) => (
              <button
                key={a.to}
                onClick={() => actionMutation.mutate(a.to)}
                disabled={actionMutation.isPending}
                className="text-sm px-3 py-1.5 rounded-lg bg-meridian-blue text-white disabled:opacity-50"
              >
                {a.label ?? a.to}
              </button>
            ))}
          </div>
        )}
      </Card>
      <Card title="Timeline">
        <Timeline steps={steps} />
      </Card>
    </div>
  )
}

function formatValue(v) {
  if (v == null) return '—'
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  return String(v)
}

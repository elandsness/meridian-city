import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useConfig } from '../../config/ConfigContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { getEntities, createEntity, unwrapEntities } from '../../api/entities.js'
import { displayName } from '../../lib/format.js'
import Card from '../../ui/Card.jsx'
import Button from '../../ui/Button.jsx'
import { getEntityDef } from './entityConfig.js'

// --- Sub-components ---

function JourneyStepper({ entity, def, stepsProp }) {
  const resolveSteps = (d, s) => {
    const order = s ?? (d?.stages ? Object.keys(d.stages) : [])
    return order
      .map((stateKey) => (typeof stateKey === 'string' ? { state: stateKey } : stateKey))
      .filter(({ state }) => !d?.states?.[state]?.isError)
  }

  const steps = resolveSteps(def, stepsProp)
  const currentIdx = steps.findIndex(({ state }) => state === entity?.state)

  return (
    <div className="overflow-auto">
      <div className="flex items-center min-w-max">
        {steps.map(({ state, label: stepLabel }, i) => {
          const stateMeta = def?.states?.[state] ?? {}
          const done = currentIdx >= i
          const current = entity?.state === state
          const displayLabel = stepLabel ?? stateMeta.label ?? state.replace(/_/g, ' ')
          return (
            <div key={state} className="flex items-center">
              <div className="flex flex-col items-center w-20">
                <div className={`w-4 h-4 rounded-full border-2 transition-colors ${done ? 'bg-[rgb(var(--brand))] border-[rgb(var(--brand))]' : 'bg-white border-slate-300'} ${current ? 'ring-4 ring-[rgb(var(--brand))]/20 scale-125' : ''}`} />
                <span className={`mt-1.5 text-[10px] leading-tight text-center px-1 ${done ? 'text-slate-700 font-medium' : 'text-slate-400'}`}>
                  {displayLabel}
                </span>
              </div>
              {! (i === steps.length - 1) && (
                <div className={`h-0.5 w-6 mb-5 ${currentIdx > i ? 'bg-[rgb(var(--brand))]' : 'bg-slate-200'}`} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function EntityCard({ entity, def, stepsProp, label }) {
  const displayId = entity.id?.slice(-6) ?? entity.id
  const stateMeta = def?.states?.[entity.state] ?? {}
  const toneClass = {
    slate: 'bg-slate-100 text-slate-600',
    blue: 'bg-blue-50 text-blue-700',
    amber: 'bg-amber-50 text-amber-700',
    orange: 'bg-orange-50 text-orange-700',
    green: 'bg-green-50 text-green-700',
    red: 'bg-red-50 text-red-700',
  }[stateMeta.tone] ?? 'bg-slate-100 text-slate-600'

  return (
    <Card>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <p className="font-semibold text-slate-900">{def?.displayName ?? label} #{displayId}</p>
          <p className="text-xs text-slate-400 mt-0.5">
            {entity.created_at ? new Date(entity.created_at).toLocaleString() : ''}
          </p>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${toneClass}`}>
          {stateMeta.label ?? entity.state}
        </span>
      </div>
      <JourneyStepper entity={entity} def={def} stepsProp={stepsProp} />
    </Card>
  )
}

function PersonalJourney({ entityType, userId, userName, ownerField, label, stepsProp, description, cfg, def }) {
  const queryClient = useQueryClient()
  const queryKey = ['entity-journey-mine', entityType, userId]

  const { data, isLoading, isError } = useQuery({
    queryKey,
    queryFn: () => getEntities(entityType, { [ownerField]: userId }),
    refetchInterval: 8000,
  })
  const entities = unwrapEntities(data)
  const entity = entities[0]

  const { mutate: create, isPending: isCreating } = useMutation({
    mutationFn: () => createEntity(entityType, { [ownerField]: userId, name: userName }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })

  const noEntity = !isLoading && !isError && !entity && !isCreating

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{label ?? def?.displayName ?? 'My Journey'}</h1>
        <p className="text-slate-500 text-sm mt-1">{description ?? `Track your progress through ${cfg.company.name}.`}</p>
      </div>

      {(isLoading || isCreating) && <p className="text-slate-500 text-sm">Loading…</p>}
      {isError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">Couldn\'t load your journey.</p>}

      {noEntity && (
        <Card>
          <div className="text-center py-8 space-y-3">
            <p className="text-slate-500">You don\'t have an active {def?.displayName ?? label ?? 'journey'} yet.</p>
            <Button variant="primary" size="sm" onClick={() => create()}>
              Start a {def?.displayName ?? label ?? 'journey'}
            </Button>
          </div>
        </Card>
      )}

      {entity && <EntityCard entity={entity} def={def} stepsProp={stepsProp} label={label} />}
    </div>
  )
}

function LiveBoard({ entityType, label, description, cfg, def, stepsProp, isAuthenticated }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['entity-journey-board', entityType],
    queryFn: () => getEntities(entityType),
    refetchInterval: 10_000,
  })
  const entities = unwrapEntities(data)

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{label ?? def?.displayNamePlural ?? 'Journeys'}</h1>
          <p className="text-slate-500 text-sm mt-1">{description ?? `Live journey tracking through ${cfg.company.name}.`}</p>
        </div>
        {!isAuthenticated && (
          <Button to="/login" variant="primary" size="sm">Log in to track your journey</Button>
        )}
      </div>

      {isLoading && <p className="text-slate-500 text-sm">Loading…</p>}
      {isError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py,3">Failed to load journeys.</p>}

      {!isLoading && !isError && entities.length === 0 && (
        <Card>
          <div className="text-center py-8">
            <p className="text-slate-400">No active journeys right now.</p>
          </div>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {entities.map((e) => (
          <EntityCard key={e.id} entity={e} def={def} stepsProp={stepsProp} label={label} />
        ))}
      </div>
    </div>
  )
}

export default function EntityJourneyPage({ entityType, label, ownerField, steps: stepsProp, description }) {
  const cfg = useConfig()
  const { isAuthenticated, user } = useAuth()
  const def = getEntityDef(cfg, entityType)

  const userId = user?.id
  const userName = displayName(user)
  const showPersonal = !!(ownerField && userId)

  if (showPersonal) {
    return (
      <PersonalJourney 
        entityType={entityType} 
        userId={userId} 
        userName={userName} 
        ownerField={ownerField} 
        label={label} 
        stepsProp={stepsProp} 
        description={description} 
        cfg={cfg} 
        def={def} 
      />
    )
  }

  return (
    <LiveBoard 
      entityType={entityType} 
      label={label} 
      description={description} 
      cfg={cfg} 
      def={def} 
      stepsProp={stepsProp} 
      isAuthenticated={isAuthenticated} 
    />
  )
}

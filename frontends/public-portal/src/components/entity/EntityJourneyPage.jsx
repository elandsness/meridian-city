import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useConfig } from '../../config/ConfigContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { getEntities, createEntity, unwrapEntities } from '../../api/entities.js'
import { displayName } from '../../lib/format.js'
import Card from '../../ui/Card.jsx'
import Button from '../../ui/Button.jsx'
import { getEntityDef } from './entityConfig.js'
import EntityCard from './EntityCard.jsx'

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

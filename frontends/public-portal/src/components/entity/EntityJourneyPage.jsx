import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useConfig } from '../../config/ConfigContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { useNavigate } from 'react-router-dom'
import { getEntities, createEntity, unwrapEntities } from '../../api/entities.js'
import { displayName } from '../../lib/format.js'
import Card from '../../ui/Card.jsx'
import Button from '../../ui/Button.jsx'
import { getEntityDef } from './entityConfig.js'
import EntityCard from './EntityCard.jsx'

function PersonalJourney({ entityType, userId, userName, ownerField, label, stepsProp, description, cfg, def }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const queryKey = ['entity-journey-mine', entityType, userId]

  const { data, isLoading, isError } = useQuery({
    queryKey,
    queryFn: () => getEntities(entityType, { [ownerField]: userId }),
    refetchInterval: 8000,
  })
  const entities = unwrapEntities(data)

  const { mutate: create, isPending: isCreating } = useMutation({
    mutationFn: () => createEntity(entityType, { [ownerField]: userId, name: userName }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })

  const handleStart = () => {
    if (entityType === 'permit') {
      navigate('/service-requests/new')
    } else {
      create()
    }
  }

  const noEntity = !isLoading && !isError && entities.length === 0 && !isCreating

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{label ?? def?.displayNamePlural ?? 'My Journeys'}</h1>
          <p className="text-slate-500 text-sm mt-1">{description ?? `Track your active ${def?.displayName?.toLowerCase() || 'journeys'} through ${cfg.company.name}.`}</p>
        </div>
        {entities.length > 0 && (
          <Button variant="outline" size="sm" onClick={handleStart}>
            + Start New {def?.displayName ?? 'Journey'}
          </Button>
        )}
      </div>

      {(isLoading || isCreating) && <p className="text-slate-500 text-sm">Loading…</p>}
      {isError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">Couldn't load your journeys.</p>}

      {noEntity && (
        <Card className="bg-slate-50/50 border-dashed border-2 border-slate-200">
          <div className="text-center py-12 space-y-4">
            <div className="text-4xl">🚛</div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-slate-900">Ready to hit the road?</h3>
              <p className="text-slate-500 max-w-sm mx-auto text-sm">
                {entityType === 'permit' 
                  ? 'An active Access Permit allows you to operate oversized or high-productivity vehicles on the national network. Apply now to get your journey started.'
                  : `You don't have any active ${def?.displayName?.toLowerCase()} yet.`}
              </p>
            </div>
            <Button variant="primary" size="md" onClick={handleStart} className="px-8">
              {entityType === 'permit' ? 'Apply for your first permit' : `Start a ${def?.displayName ?? 'journey'}`}
            </Button>
          </div>
        </Card>
      )}

      <div className="grid gap-4">
        {entities.map((entity) => (
          <EntityCard key={entity.id} entity={entity} def={def} stepsProp={stepsProp} label={label} />
        ))}
      </div>
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
      {isError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">Failed to load journeys.</p>}

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
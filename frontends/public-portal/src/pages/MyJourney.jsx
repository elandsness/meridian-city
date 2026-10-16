import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useConfig } from '../config/ConfigContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { createEntity, unwrapEntities } from '../api/entities.js'
import { getMyJourney } from '../api/journeys.js'
import { displayName } from '../lib/format.js'
import Card from '../ui/Card.jsx'
import Button from '../ui/Button.jsx'
import EntityCard from '../components/entity/EntityCard.jsx'

export default function MyJourney() {
  const cfg = useConfig()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const entityType = 'passenger'
  const ownerField = 'user_id'
  const label = 'My Journey'
  
  const userId = user?.id
  const userName = displayName(user)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['my-journey-personal', userId],
    queryFn: () => getMyJourney(userId, userName),
    enabled: !!userId,
    refetchInterval: 8000,
  })
  
  const entities = unwrapEntities(data)
  const entity = entities[0]

  const { mutate: create, isPending: isCreating } = useMutation({
    mutationFn: () => createEntity(entityType, { [ownerField]: userId, name: userName }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-journey-personal', userId] }),
  })

  if (!userId) return <div className="p-8 text-center">Please log in to view your journey.</div>
  if (isLoading) return <div className="p-8 text-center">Loading your journey...</div>
  if (isError) return <div className="p-8 text-center text-red-600">Error loading journey.</div>

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{label}</h1>
        <p className="text-slate-500 text-sm mt-1">Track your progress through {cfg.company.name}.</p>
      </div>

      {!entity && !isCreating ? (
        <Card>
          <div className="text-center py-8 space-y-3">
            <p className="text-slate-500">You don\'t have an active journey yet.</p>
            <Button variant="primary" size="sm" onClick={() => create()}>
              Start My Journey
            </Button>
          </div>
        </Card>
      ) : (
        entity && <EntityCard entity={entity} label={label} />
      )}
    </div>
  )
}

function unwrapEntities(d) {
  return Array.isArray(d) ? d : d?.entities ?? d?.items ?? []
}

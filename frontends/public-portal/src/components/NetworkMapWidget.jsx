import { useQuery } from '@tanstack/react-query'
import { useConfig } from '../config/ConfigContext'
import { getEntities, unwrapEntities } from '../api/entities.js'
import { getEntityDef } from './entity/entityConfig.js'
import { toSprites } from './entity/entityMapData.js'
import EntityMap from './entitymap/EntityMap.jsx'
import Card from '../ui/Card.jsx'

export default function NetworkMapWidget({ entityType, viewBox, background, guides, labelField, title }) {
  const config = useConfig()
  const def = getEntityDef(config, entityType)

  const { data, isLoading } = useQuery({
    queryKey: ['entities', entityType],
    queryFn: () => getEntities(entityType),
    refetchInterval: 8000,
  })

  const entities = unwrapEntities(data)
  const sprites = toSprites(entities, def, labelField)

  return (
    <Card title={title || def?.displayNamePlural || entityType} action={<span className="text-xs text-slate-400">{sprites.length} active</span>}>
      <EntityMap
        viewBox={viewBox || '0 0 1000 600'}
        background={background}
        guides={guides}
        sprites={sprites}
        emptyMessage={isLoading ? 'Loading…' : 'Nothing active right now.'}
      />
    </Card>
  )
}

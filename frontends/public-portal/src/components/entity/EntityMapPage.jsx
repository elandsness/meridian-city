import { useQuery } from '@tanstack/react-query'
import { useConfig } from '../../config/ConfigContext.jsx'
import { getEntities, unwrapEntities } from '../../api/entities.js'
import { getEntityDef } from './entityConfig.js'
import { toSprites, toLegend } from './entityMapData.js'
import EntityMap from '../entitymap/EntityMap.jsx'
import Card from '../../ui/Card.jsx'

// Generic `entity-map` full-page screen template. Replaces the old bespoke
// AirfieldMap.jsx-style pages: same shared EntityMap component any entity type
// can use, decorated via this screen's config (background/viewBox/labelField).
export default function EntityMapPage({ entityType, viewBox, background, labelField }) {
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
    <Card title={def?.displayNamePlural ?? entityType} action={<span className="text-xs text-slate-400">{sprites.length} active</span>}>
      <EntityMap
        viewBox={viewBox}
        background={background}
        sprites={sprites}
        legend={toLegend(def)}
        emptyMessage={isLoading ? 'Loading…' : 'Nothing active right now.'}
      />
    </Card>
  )
}

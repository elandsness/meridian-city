import { useQuery } from '@tanstack/react-query'
import { useConfig } from '../../config/ConfigContext.jsx'
import { getEntities, unwrapEntities } from '../../api/entities.js'
import { getEntityDef } from './entityConfig.js'
import { toSprites, toLegend } from './entityMapData.js'
import EntityMap from '../entitymap/EntityMap.jsx'
import Card from '../../ui/Card.jsx'

// Generic `entity-map` home-module card -- the same shared EntityMap component
// as EntityMapPage, just in a compact home-page card instead of a full screen.
export default function EntityMapCard({ entityType, viewBox, background, labelField }) {
  const config = useConfig()
  const def = getEntityDef(config, entityType)

  const { data } = useQuery({
    queryKey: ['entities', entityType],
    queryFn: () => getEntities(entityType),
    refetchInterval: 8000,
  })
  const entities = unwrapEntities(data)
  const sprites = toSprites(entities, def, labelField)

  return (
    <Card title={def?.displayNamePlural ?? entityType}>
      <EntityMap viewBox={viewBox} background={background} sprites={sprites} legend={toLegend(def)} />
    </Card>
  )
}

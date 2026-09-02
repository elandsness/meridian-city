import { useQuery } from '@tanstack/react-query';
import { useConfig } from '../../config/ConfigContext.jsx';
import { getEntities, unwrapEntities } from '../../api/entities.js';
import { getEntityDef } from './entityConfig.js';
import { toSprites, toLegend } from './entityMapData.js';
import EntityMap from '../entitymap/EntityMap.jsx';

// Generic `entity-map` home-module card -- the same shared EntityMap component
// as EntityMapPage, just in a compact home-page card instead of a full screen.
export default function EntityMapCard({ entityType, viewBox, background, labelField }) {
  const config = useConfig();
  const def = getEntityDef(config, entityType);

  const { data } = useQuery({
    queryKey: ['entities', entityType],
    queryFn: () => getEntities(entityType),
    refetchInterval: 8000,
  });
  const entities = unwrapEntities(data);
  const sprites = toSprites(entities, def, labelField);

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
      <h2 className="text-lg font-semibold text-white mb-4">{def?.displayNamePlural ?? entityType}</h2>
      <EntityMap viewBox={viewBox} background={background} sprites={sprites} legend={toLegend(def)} />
    </div>
  );
}

import { useQuery } from '@tanstack/react-query';
import { useConfig } from '../../config/ConfigContext.jsx';
import { getEntities, unwrapEntities } from '../../api/entities.js';
import { getEntityDef } from './entityConfig.js';
import { toSprites, toLegend } from './entityMapData.js';
import EntityMap from '../entitymap/EntityMap.jsx';

// Generic `entity-map` full-page screen template. Replaces the old bespoke
// AirfieldMap.jsx-style pages: same shared EntityMap component any entity type
// can use, decorated via this screen's config (background/viewBox/labelField).
export default function EntityMapPage({ entityType, viewBox, background, labelField }) {
  const config = useConfig();
  const def = getEntityDef(config, entityType);

  const { data, isLoading } = useQuery({
    queryKey: ['entities', entityType],
    queryFn: () => getEntities(entityType),
    refetchInterval: 8000,
  });
  const entities = unwrapEntities(data);
  const sprites = toSprites(entities, def, labelField);

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">{def?.displayNamePlural ?? entityType}</h2>
        <span className="text-xs text-gray-500">{sprites.length} active</span>
      </div>
      <EntityMap
        viewBox={viewBox}
        background={background}
        sprites={sprites}
        legend={toLegend(def)}
        emptyMessage={isLoading ? 'Loading…' : 'Nothing active right now.'}
      />
    </div>
  );
}

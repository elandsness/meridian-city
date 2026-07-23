import { getStateMeta } from './entityConfig.js'

const TONE_COLOR = {
  slate: '#94a3b8',
  blue: '#2563eb',
  amber: '#d97706',
  orange: '#ea580c',
  green: '#16a34a',
  red: '#dc2626',
}

// Maps a list of entity API responses to EntityMap's `sprites` prop. Position
// comes straight from the entity's backend-computed `position` field (see
// movement-service) -- never invented client-side. An entity with no position
// yet (not tracked by movement-service, or a fresh row before its first tick)
// is simply omitted rather than rendered at a guessed spot. `labelField` is an
// optional screen-config option naming which field to show next to the sprite
// (no entity-type-specific field name is ever assumed here).
//
// Terminal-state entities (config-declared terminal:true) are excluded --
// found via an actual live check: the entity API never stops returning
// completed/historical rows, so without this a "live" map silently
// accumulates every entity that ever finished, piling sprites on top of each
// other at the terminal waypoint forever. Generalizes AirfieldMap.jsx's own
// hardcoded TERMINAL_STATES filter (departed/arrived/cancelled) via config
// instead of a hardcoded status list.
export function toSprites(entities, def, labelField) {
  return entities
    .filter((e) => e.position && typeof e.position.x === 'number')
    .filter((e) => !getStateMeta(def, e.state).terminal)
    .map((e) => {
      const meta = getStateMeta(def, e.state)
      return {
        id: e.id,
        coordinate: { x: e.position.x, y: e.position.y },
        glyph: meta.glyph,
        color: TONE_COLOR[meta.tone] || TONE_COLOR.slate,
        label: labelField ? e[labelField] : undefined,
      }
    })
}

export function toLegend(def) {
  if (!def?.states) return []
  return Object.entries(def.states)
    .filter(([, meta]) => meta.glyph || meta.tone)
    .map(([id, meta]) => ({
      label: meta.label ?? id,
      glyph: meta.glyph,
      color: TONE_COLOR[meta.tone] || TONE_COLOR.slate,
    }))
}

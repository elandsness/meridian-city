// Small helpers for reading the config-driven entity vocabulary (industry.entities
// -- see docs/industry-config.schema.json's `entityType` $def) that the four
// generic page templates all need. Duplicated into ops-dashboard's tree too,
// following the established per-app-duplication convention (ConfigContext.jsx).
export function getEntityDef(config, entityType) {
  return config?.entities?.[entityType]
}

export function getStateMeta(def, state) {
  return def?.states?.[state] ?? {}
}

// Ordered list of state ids as declared in config -- drives the timeline/stepper.
export function getStateOrder(def) {
  return def?.states ? Object.keys(def.states) : []
}

// Dark-theme badge palette, matching IncidentBadge.jsx's convention.
const TONE_CLASSES = {
  slate: 'bg-gray-600/40 text-gray-400 border border-gray-600/50',
  blue: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  amber: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  orange: 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
  green: 'bg-green-500/20 text-green-400 border border-green-500/30',
  red: 'bg-red-500/20 text-red-400 border border-red-500/30',
}

export function toneBadgeClass(tone) {
  return TONE_CLASSES[tone] || TONE_CLASSES.slate
}

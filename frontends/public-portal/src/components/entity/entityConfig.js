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

const TONE_CLASSES = {
  slate: 'bg-slate-100 text-slate-600',
  blue: 'bg-blue-50 text-blue-700',
  amber: 'bg-amber-50 text-amber-700',
  orange: 'bg-orange-50 text-orange-700',
  green: 'bg-green-50 text-green-700',
  red: 'bg-red-50 text-red-700',
}

export function toneBadgeClass(tone) {
  return TONE_CLASSES[tone] || TONE_CLASSES.slate
}

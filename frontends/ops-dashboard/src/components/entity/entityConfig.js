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

// Ordered list of state ids -- drives the timeline/stepper.
// JSON object keys are sorted alphabetically by Go/Helm serialization, so
// Object.keys(states) gives wrong order. The transitions array is order-stable
// (JSON arrays preserve insertion order), so BFS from `initial` via transitions
// reconstructs the declaration order the author intended.
export function getStateOrder(def) {
  if (!def?.states) return []
  const initial = def.initial
  if (!initial) return Object.keys(def.states)
  const visited = new Set()
  const order = []
  const queue = [initial]
  while (queue.length > 0) {
    const state = queue.shift()
    if (visited.has(state)) continue
    visited.add(state)
    order.push(state)
    for (const t of def.transitions ?? []) {
      if (t.from === state && !visited.has(t.to) && def.states[t.to]) {
        queue.push(t.to)
      }
    }
  }
  for (const s of Object.keys(def.states)) {
    if (!visited.has(s)) order.push(s)
  }
  return order
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

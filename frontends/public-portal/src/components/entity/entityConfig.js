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

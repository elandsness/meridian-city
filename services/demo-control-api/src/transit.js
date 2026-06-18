'use strict'

/**
 * In-memory transit simulation for the public-portal transit map.
 *
 * Owns a static schematic topology (2 regional rail lines, 1 subway, 4 bus routes)
 * plus a live vehicle/status model advanced on a timer. Each line has one vehicle
 * that bounces back and forth along its stops; per-line status is randomly managed,
 * weighted heavily toward on-time.
 *
 * Exposed read-only via GET /api/v1/transit/lines (topology) and
 * GET /api/v1/transit/status (live vehicles). Single-instance service, so a plain
 * in-memory model is fine — no DB/Kafka. Stop coordinates + label hints live here so
 * the frontend is a pure renderer and there's one source of truth for the schematic.
 */

const TICK_MS = 4000
const STATUS_REROLL_CHANCE = 0.25

// Shared multimodal interchange — referenced by the two rail lines + the subway.
const HUB = {
  id: 'meridian-central', name: 'Meridian Central', x: 340, y: 220,
  label: { dx: -12, dy: 30, anchor: 'end' },
}

const LINES = [
  {
    id: 'harbor', name: 'Harbor Line', mode: 'rail', color: '#1D9E75',
    stops: [
      { id: 'west-harbor', name: 'West Harbor', x: 110, y: 220, label: { dx: 0, dy: -14, anchor: 'middle' } },
      { id: 'dockside', name: 'Dockside', x: 225, y: 220, label: { dx: 0, dy: -14, anchor: 'middle' } },
      HUB,
      { id: 'forge-st', name: 'Forge St', x: 460, y: 220, label: { dx: 0, dy: -14, anchor: 'middle' } },
      { id: 'east-industrial', name: 'East Industrial', x: 585, y: 220, label: { dx: 0, dy: -14, anchor: 'middle' } },
    ],
  },
  {
    id: 'meridian', name: 'Meridian Line', mode: 'rail', color: '#7F77DD',
    stops: [
      { id: 'north-district', name: 'North District', x: 340, y: 90, label: { dx: 12, dy: 4, anchor: 'start' } },
      { id: 'parkway', name: 'Parkway', x: 340, y: 155, label: { dx: 12, dy: 4, anchor: 'start' } },
      HUB,
      { id: 'market-sq', name: 'Market Sq', x: 340, y: 295, label: { dx: 12, dy: 4, anchor: 'start' } },
      { id: 'south-district', name: 'South District', x: 340, y: 360, label: { dx: 12, dy: 4, anchor: 'start' } },
    ],
  },
  {
    id: 'central', name: 'Central Loop', mode: 'subway', color: '#E24B4A',
    stops: [
      { id: 'civic-plaza', name: 'Civic Plaza', x: 250, y: 140, label: { dx: -10, dy: -12, anchor: 'end' } },
      HUB,
      { id: 'riverside', name: 'Riverside', x: 430, y: 300, label: { dx: 8, dy: 4, anchor: 'start' } },
    ],
  },
  {
    id: 'harborside', name: 'Harborside', mode: 'bus', color: '#EF9F27',
    stops: [
      { id: 'hb-1', name: 'Harborside North', x: 120, y: 168, label: null },
      { id: 'hb-2', name: 'Harborside Mid', x: 168, y: 138, label: null },
      { id: 'hb-3', name: 'Harborside End', x: 216, y: 110, label: null },
    ],
  },
  {
    id: 'uptown', name: 'Uptown', mode: 'bus', color: '#378ADD',
    stops: [
      { id: 'up-1', name: 'Uptown South', x: 444, y: 110, label: null },
      { id: 'up-2', name: 'Uptown Mid', x: 492, y: 138, label: null },
      { id: 'up-3', name: 'Uptown North', x: 560, y: 162, label: null },
    ],
  },
  {
    id: 'eastgate', name: 'Eastgate', mode: 'bus', color: '#D4537E',
    stops: [
      { id: 'eg-1', name: 'Eastgate West', x: 444, y: 330, label: null },
      { id: 'eg-2', name: 'Eastgate Mid', x: 500, y: 312, label: null },
      { id: 'eg-3', name: 'Eastgate East', x: 560, y: 292, label: null },
    ],
  },
  {
    id: 'riverwalk', name: 'Riverwalk', mode: 'bus', color: '#639922',
    stops: [
      { id: 'rw-1', name: 'Riverwalk West', x: 120, y: 302, label: null },
      { id: 'rw-2', name: 'Riverwalk Mid', x: 170, y: 322, label: null },
      { id: 'rw-3', name: 'Riverwalk East', x: 220, y: 340, label: null },
    ],
  },
]

// One vehicle per line; staggered starting positions so they don't all move in sync.
const vehicles = LINES.map((line, i) => ({
  lineId: line.id,
  stopIndex: i % line.stops.length,
  direction: 1,
  status: 'on_time',
  delayMinutes: 0,
}))

function rerollStatus (v) {
  const r = Math.random()
  if (r < 0.75) {
    v.status = 'on_time'
    v.delayMinutes = 0
  } else if (r < 0.90) {
    v.status = 'late'
    v.delayMinutes = 2 + Math.floor(Math.random() * 5) // 2..6
  } else {
    v.status = 'early'
    v.delayMinutes = 1 + Math.floor(Math.random() * 3) // 1..3
  }
}

function tick () {
  for (let i = 0; i < vehicles.length; i++) {
    const v = vehicles[i]
    const len = LINES[i].stops.length
    // Bounce back and forth along the line.
    if (v.stopIndex + v.direction < 0 || v.stopIndex + v.direction > len - 1) {
      v.direction *= -1
    }
    v.stopIndex += v.direction
    if (Math.random() < STATUS_REROLL_CHANCE) {
      rerollStatus(v)
    }
  }
}

let timer = null
function startTransitSimulation () {
  if (timer) return
  timer = setInterval(tick, TICK_MS)
  if (timer.unref) timer.unref()
}

function getLines () {
  return { lines: LINES }
}

function getStatus () {
  return {
    lines: vehicles.map((v, i) => ({
      line_id: v.lineId,
      current_stop_id: LINES[i].stops[v.stopIndex].id,
      status: v.status,
      delay_minutes: v.delayMinutes,
    })),
  }
}

module.exports = { startTransitSimulation, getLines, getStatus }

'use strict'

/**
 * In-memory transit simulation for the public-portal transit map.
 *
 * Owns a static schematic topology (2 regional rail lines, 1 subway, 4 bus routes)
 * plus a live vehicle/status model advanced on a timer. Each line has one vehicle
 * that bounces back and forth along its stops; per-line status is randomly managed,
 * weighted heavily toward on-time.
 *
 * Stops carry schematic x/y coordinates; the frontend draws each route as a smooth
 * spline *through* those points (Catmull-Rom), so the geometry reads like a real
 * transit diagram rather than straight segments. Routes are laid out radiating from
 * the central interchange with gentle curves, à la SEPTA's regional rail map.
 *
 * Exposed read-only via GET /api/v1/transit/lines (topology) and
 * GET /api/v1/transit/status (live vehicles). Single-instance service, so a plain
 * in-memory model is fine — no DB/Kafka. Stop coordinates + label hints live here so
 * the frontend is a pure renderer and there's one source of truth for the schematic.
 */

// One step per minute so vehicles dwell at a stop and glide to the next over a
// realistic interval rather than skittering. The frontend polls on the same cadence.
const TICK_MS = 60000
const STATUS_REROLL_CHANCE = 0.3

// Shared multimodal interchange — referenced by the two rail lines + the subway.
const HUB = {
  id: 'meridian-central', name: 'Meridian Central', x: 360, y: 235,
  label: { dx: -12, dy: 30, anchor: 'end' },
}

const LINES = [
  {
    id: 'harbor', name: 'Harbor Line', mode: 'rail', color: '#1D9E75',
    // Undulating east–west trunk along the waterfront.
    stops: [
      { id: 'west-harbor', name: 'West Harbor', x: 70, y: 250, label: { dx: 0, dy: 18, anchor: 'middle' } },
      { id: 'dockyard', name: 'Dockyard', x: 135, y: 232, label: null },
      { id: 'cannery-row', name: 'Cannery Row', x: 200, y: 222, label: { dx: 0, dy: -12, anchor: 'middle' } },
      { id: 'riverside-quay', name: 'Riverside Quay', x: 270, y: 230, label: null },
      HUB,
      { id: 'forge-st', name: 'Forge St', x: 440, y: 228, label: { dx: 0, dy: 18, anchor: 'middle' } },
      { id: 'ironworks', name: 'Ironworks', x: 510, y: 214, label: null },
      { id: 'eastgate-jct', name: 'Eastgate Jct', x: 582, y: 200, label: null },
      { id: 'east-industrial', name: 'East Industrial', x: 650, y: 186, label: { dx: 4, dy: -18, anchor: 'end' } },
    ],
  },
  {
    id: 'meridian', name: 'Meridian Line', mode: 'rail', color: '#7F77DD',
    // North–south trunk with a gentle lean through the core.
    stops: [
      { id: 'north-heights', name: 'North Heights', x: 350, y: 46, label: { dx: 12, dy: 4, anchor: 'start' } },
      { id: 'greenfield', name: 'Greenfield', x: 368, y: 102, label: null },
      { id: 'highbridge', name: 'Highbridge', x: 374, y: 158, label: { dx: 12, dy: 4, anchor: 'start' } },
      HUB,
      { id: 'market-sq', name: 'Market Sq', x: 352, y: 300, label: { dx: 12, dy: 4, anchor: 'start' } },
      { id: 'bellevue', name: 'Bellevue', x: 372, y: 352, label: null },
      { id: 'south-district', name: 'South District', x: 398, y: 410, label: { dx: 12, dy: 4, anchor: 'start' } },
    ],
  },
  {
    id: 'central', name: 'Central Loop', mode: 'subway', color: '#E24B4A',
    // Crosstown diagonal bowed through the interchange (NW → SE).
    stops: [
      { id: 'civic-plaza', name: 'Civic Plaza', x: 188, y: 128, label: { dx: -10, dy: -8, anchor: 'end' } },
      { id: 'university', name: 'University', x: 256, y: 150, label: null },
      { id: 'old-town', name: 'Old Town', x: 318, y: 196, label: null },
      HUB,
      { id: 'riverside', name: 'Riverside', x: 424, y: 294, label: { dx: 12, dy: 4, anchor: 'start' } },
      { id: 'stadium', name: 'Stadium', x: 476, y: 352, label: null },
      { id: 'quarry-end', name: 'Quarry End', x: 520, y: 416, label: { dx: 12, dy: 4, anchor: 'start' } },
    ],
  },
  {
    id: 'harborside', name: 'Harborside', mode: 'bus', color: '#EF9F27',
    // NW feeder arcing over the harbor, then diving SE into the interchange.
    stops: [
      { id: 'hb-1', name: 'Harborside 1', x: 96, y: 176, label: null },
      { id: 'hb-2', name: 'Harborside 2', x: 132, y: 150, label: null },
      { id: 'hb-3', name: 'Harborside 3', x: 174, y: 131, label: null },
      { id: 'hb-4', name: 'Harborside 4', x: 220, y: 122, label: null },
      { id: 'hb-5', name: 'Harborside 5', x: 264, y: 128, label: null },
      { id: 'hb-6', name: 'Harborside 6', x: 304, y: 160, label: null },
      { id: 'hb-7', name: 'Harborside 7', x: 336, y: 200, label: null },
      HUB,
    ],
  },
  {
    id: 'uptown', name: 'Uptown', mode: 'bus', color: '#378ADD',
    // NE feeder ordered outer → interchange (curves SW into the hub).
    stops: [
      { id: 'up-5', name: 'Uptown 5', x: 618, y: 214, label: null },
      { id: 'up-4', name: 'Uptown 4', x: 588, y: 178, label: null },
      { id: 'up-3', name: 'Uptown 3', x: 548, y: 148, label: null },
      { id: 'up-2', name: 'Uptown 2', x: 502, y: 128, label: null },
      { id: 'up-1', name: 'Uptown 1', x: 452, y: 118, label: null },
      { id: 'up-6', name: 'Uptown 6', x: 420, y: 150, label: null },
      { id: 'up-7', name: 'Uptown 7', x: 388, y: 195, label: null },
      HUB,
    ],
  },
  {
    id: 'eastgate', name: 'Eastgate', mode: 'bus', color: '#D4537E',
    // SE feeder ordered outer → interchange (curves NW into the hub).
    stops: [
      { id: 'eg-5', name: 'Eastgate 5', x: 628, y: 306, label: null },
      { id: 'eg-4', name: 'Eastgate 4', x: 592, y: 332, label: null },
      { id: 'eg-3', name: 'Eastgate 3', x: 548, y: 346, label: null },
      { id: 'eg-2', name: 'Eastgate 2', x: 502, y: 336, label: null },
      { id: 'eg-1', name: 'Eastgate 1', x: 452, y: 322, label: null },
      { id: 'eg-6', name: 'Eastgate 6', x: 418, y: 295, label: null },
      { id: 'eg-7', name: 'Eastgate 7', x: 388, y: 262, label: null },
      HUB,
    ],
  },
  {
    id: 'riverwalk', name: 'Riverwalk', mode: 'bus', color: '#639922',
    // SW feeder arcing along the river, then climbing NE into the interchange.
    stops: [
      { id: 'rw-1', name: 'Riverwalk 1', x: 96, y: 306, label: null },
      { id: 'rw-2', name: 'Riverwalk 2', x: 134, y: 336, label: null },
      { id: 'rw-3', name: 'Riverwalk 3', x: 180, y: 356, label: null },
      { id: 'rw-4', name: 'Riverwalk 4', x: 230, y: 360, label: null },
      { id: 'rw-5', name: 'Riverwalk 5', x: 276, y: 344, label: null },
      { id: 'rw-6', name: 'Riverwalk 6', x: 312, y: 312, label: null },
      { id: 'rw-7', name: 'Riverwalk 7', x: 340, y: 278, label: null },
      HUB,
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

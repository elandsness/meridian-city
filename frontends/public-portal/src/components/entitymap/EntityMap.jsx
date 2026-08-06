// Generic "background image + moving sprites" map, decorated entirely via
// props/config — the shared component behind City's transit map and Airport's
// airfield map (and any future industry's map: parts on an assembly line,
// fans filing into gates, whatever). Pure presentational: no data-fetching, no
// internal setInterval tick. Position for each sprite comes from the backend
// (movement-service computes+persists it) — this component just renders the
// coordinate it's given and lets a CSS transition handle the visual glide
// between polls, the same way the old TransitPanel always trusted backend
// state rather than inventing client-side timing.
//
// Duplicated into ops-dashboard's tree too (see that copy) — this repo has no
// shared build/workspace tooling between the two SPAs (ConfigContext.jsx/
// defaults.js are already hand-duplicated the same way), so this follows the
// established convention rather than introducing one mid-initiative.
export default function EntityMap({
  viewBox = '0 0 1000 600',
  background,
  guides = [],
  waypoints = [],
  sprites = [],
  transitionMs = 1600,
  legend = [],
  emptyMessage,
}) {
  const hasContent = sprites.length > 0

  return (
    <div className="relative w-full">
      <svg viewBox={viewBox} className="w-full h-auto" role="img">
        <Background background={background} />
        {guides.map((g) => (
          <Guide key={g.id} guide={g} />
        ))}
        {waypoints.map((w) => (
          <circle key={w.id} cx={w.x} cy={w.y} r={4} fill={w.color || '#94a3b8'} />
        ))}
        {sprites.map((s) => (
          <Sprite key={s.id} sprite={s} transitionMs={transitionMs} />
        ))}
      </svg>
      {!hasContent && emptyMessage && (
        <p className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">
          {emptyMessage}
        </p>
      )}
      {legend.length > 0 && (
        <div className="flex flex-wrap gap-4 mt-3">
          {legend.map((l, i) => (
            <span key={i} className="flex items-center gap-1.5 text-xs text-slate-500">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full"
                style={{ background: l.color }}
              />
              {l.glyph && <span>{l.glyph}</span>}
              {l.label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function Background({ background }) {
  if (!background || background.kind === 'none') return null
  if (background.kind === 'image') {
    return <image href={background.src} x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" />
  }
  if (background.kind === 'shapes') {
    return (
      <>
        {(background.shapes || []).map((shape, i) => <Shape key={i} shape={shape} />)}
      </>
    )
  }
  // 'preset' backgrounds (e.g. a bundled airfield/transit-blank diagram) are
  // resolved by the caller into 'shapes' before reaching this component --
  // EntityMap itself only knows the four primitive kinds above, so a new
  // preset never requires touching this file.
  return null
}

function Shape({ shape }) {
  const { type, text: textContent, ...attrs } = shape
  if (type === 'rect') return <rect {...attrs} />
  if (type === 'line') return <line {...attrs} />
  if (type === 'circle') return <circle {...attrs} />
  if (type === 'text') return <text {...attrs}>{textContent}</text>
  return null
}

// Straight polyline through an ordered list of waypoints — schematic transit-map
// style where each segment reads clearly, without decorative curves.
function Guide({ guide }) {
  const pts = guide.waypoints || []
  if (pts.length < 2) return null
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  return (
    <path
      d={d}
      fill="none"
      stroke={guide.color || '#94a3b8'}
      strokeWidth={guide.width || 3}
      strokeDasharray={guide.dash}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  )
}

// One moving entity. `glyph` absent -> a plain colored dot + pulsing halo
// (preserves TransitPanel's exact look); `glyph` present -> an emoji/unicode
// character via <text> (satisfies "sprites are emoji/glyph only" for now).
// Position glides via a CSS transform transition -- no client-invented tick.
function Sprite({ sprite, transitionMs }) {
  const { coordinate, glyph, color = '#0C447C', rotation = 0, label } = sprite
  const style = {
    transform: `translate(${coordinate.x}px, ${coordinate.y}px)`,
    transition: `transform ${transitionMs}ms ease-in-out`,
  }
  return (
    <g style={style}>
      {glyph ? (
        <text
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={20}
          transform={rotation ? `rotate(${rotation})` : undefined}
        >
          {glyph}
        </text>
      ) : (
        <>
          <circle r={10} fill={color} opacity={0.25}>
            <animate attributeName="r" values="8;14;8" dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.35;0.05;0.35" dur="2s" repeatCount="indefinite" />
          </circle>
          <circle r={6} fill={color} stroke="white" strokeWidth={2} />
        </>
      )}
      {label && (
        <text y={-14} textAnchor="middle" fontSize={11} fill="#334155">
          {label}
        </text>
      )}
    </g>
  )
}

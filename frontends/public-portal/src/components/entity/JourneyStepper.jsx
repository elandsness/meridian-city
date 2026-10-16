import React from 'react'

export default function JourneyStepper({ entity, def, stepsProp }) {
  const resolveSteps = (d, s) => {
    const order = s ?? (d?.stages ? Object.keys(d.stages) : [])
    return order
      .map((stateKey) => (typeof stateKey === 'string' ? { state: stateKey } : stateKey))
      .filter(({ state }) => !d?.states?.[state]?.isError)
  }

  const steps = resolveSteps(def, stepsProp)
  const currentIdx = steps.findIndex(({ state }) => state === entity?.state)

  return (
    <div className="overflow-auto">
      <div className="flex items-center min-w-max">
        {steps.map(({ state, label: stepLabel }, i) => {
          const stateMeta = def?.states?.[state] ?? {}
          const done = currentIdx >= i
          const current = entity?.state === state
          const displayLabel = stepLabel ?? stateMeta.label ?? state.replace(/_/g, ' ')
          return (
            <div key={state} className="flex items-center">
              <div className="flex flex-col items-center w-20">
                <div className={`w-4 h-4 rounded-full border-2 transition-colors ${done ? 'bg-[rgb(var(--brand))] border-[rgb(var(--brand))]' : 'bg-white border-slate-300'} ${current ? 'ring-4 ring-[rgb(var(--brand))]/20 scale-125' : ''}`} />
                <span className={`mt-1.5 text-[10px] leading-tight text-center px-1 ${done ? 'text-slate-700 font-medium' : 'text-slate-400'}`}>
                  {displayLabel}
                </span>
              </div>
              {! (i === steps.length - 1) && (
                <div className={`h-0.5 w-6 mb-5 ${currentIdx > i ? 'bg-[rgb(var(--brand))]' : 'bg-slate-200'}`} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

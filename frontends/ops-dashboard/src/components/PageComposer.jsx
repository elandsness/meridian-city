// PageComposer renders a page from the industry config.
//
// The config drives the page layout:
//   config.pages[pageId].modules = [
//     { type: 'ops-overview', position: 'top' },
//     { type: 'incident-badge', position: 'top' },
//     { type: 'entity-list', position: 'main', entityType: 'incident' },
//   ]
//
// Each module's `type` is looked up in COMPONENT_REGISTRY to get the React
// component. The module object is spread as props (minus `type` and `position`),
// plus the full `config` for branding/terminology access.
//
// `position` controls layout:
//   - 'top' / undefined: standard grid cell (1/2 on md+)
//   - 'main': standard grid cell
//   - 'full': spans both columns (col-span-2)
//   - 'sidebar': rendered in a sidebar slot (currently treated as standard cell)
//
// Unknown component types render an inline warning. Missing pages render an
// error message.

import { COMPONENT_REGISTRY } from '../config/componentRegistry'

export default function PageComposer({ pageId, config }) {
  const page = config?.pages?.[pageId]

  if (!page) {
    return (
      <div className="p-6 text-red-600 bg-red-50 border border-red-200 rounded-xl">
        Page &ldquo;{pageId}&rdquo; not found in config
      </div>
    )
  }

  const modules = page.modules || []

  if (modules.length === 0) {
    return (
      <div className="p-6 text-slate-400 bg-slate-50 border border-slate-200 rounded-xl text-center">
        No modules configured for this page
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {modules.map((module, index) => {
        const Component = COMPONENT_REGISTRY[module.type]

        if (!Component) {
          return (
            <div
              key={`unknown-${index}`}
              className="p-4 text-amber-700 bg-amber-50 border border-amber-200 rounded-xl text-sm"
            >
              Unknown component type: <code className="font-mono">{module.type}</code>
            </div>
          )
        }

        // Strip layout-only keys before passing to the component
        const { type: _type, position: _position, ...moduleProps } = module

        const isFullWidth = module.position === 'full' || module.position === 'sidebar'

        return (
          <div
            key={`${module.type}-${index}`}
            className={isFullWidth ? 'md:col-span-2' : ''}
          >
            <Component {...moduleProps} config={config} />
          </div>
        )
      })}
    </div>
  )
}

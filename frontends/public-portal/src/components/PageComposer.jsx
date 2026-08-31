// PageComposer renders a page from the industry config.
//
// Two config formats are supported (new format preferred, legacy fallback):
//
//   New format:
//     config.pages[pageId].modules = [
//       { type: 'weather', position: 'top', location: 'Meridian Airport' },
//       { type: 'news-ticker', position: 'top', headlines: ['Flight 123 On Time'] },
//     ]
//
//   Legacy format (config.home.<pageId>):
//     config.home.public = [
//       { id: 'weather', location: 'Meridian Airport' },
//       { id: 'news-ticker', headlines: ['Flight 123 On Time'] },
//     ]
//
// Each module's `type` (new) or `id` (legacy) is looked up in COMPONENT_REGISTRY
// to get the React component. The module object is spread as props (minus the
// identifier key and `position`), plus the full `config` for branding/terminology.
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
  // Resolve modules: try new format (config.pages) first, fall back to legacy
  // format (config.home[pageId]), then empty array.
  const page = config?.pages?.[pageId]
  const modules = page?.modules
    || (config?.home?.[pageId])
    || []

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
        // Check both `type` (new format) and `id` (legacy format) keys.
        const componentKey = module.type || module.id
        const Component = componentKey ? COMPONENT_REGISTRY[componentKey] : undefined

        if (!Component) {
          return (
            <div
              key={`unknown-${index}`}
              className="p-4 text-amber-700 bg-amber-50 border border-amber-200 rounded-xl text-sm"
            >
              Unknown component: <code className="font-mono">{componentKey || '(none)'}
              </code>
            </div>
          )
        }

        // Strip layout-only keys before passing to the component.
        const { type: _type, id: _id, position: _position, ...moduleProps } = module

        const isFullWidth = module.position === 'full' || module.position === 'sidebar'

        return (
          <div
            key={`${componentKey}-${index}`}
            className={isFullWidth ? 'md:col-span-2' : ''}
          >
            <Component {...moduleProps} config={config} />
          </div>
        )
      })}
    </div>
  )
}

// Deprecated: home modules are now resolved through COMPONENT_REGISTRY by the
// PageComposer. This file is kept as a compatibility shim for any code that
// still imports from homeModules.jsx.
//
// The PageComposer handles module resolution from either config.pages or
// config.home, so this file is no longer the source of truth.

import { COMPONENT_REGISTRY } from './componentRegistry'

export const HOME_MODULES = COMPONENT_REGISTRY

export function getActiveHomeModules(config) {
  // No-op: PageComposer handles module resolution now.
  // Returns empty array so callers that iterate modules render nothing.
  return []
}

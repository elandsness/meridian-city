// Thin wrapper around the Dynatrace RUM JS API (window.dtrum), which is injected
// at runtime by nginx (see helm/templates/frontend-nginx-configmap.yaml). Every
// call is a safe no-op when RUM is absent (e.g. local dev without the snippet),
// so call sites never need to guard.
//
// Custom-action names + their correlation properties are catalogued in
// docs/INSTRUMENTATION.md.

function dt() {
  return typeof window !== 'undefined' ? window.dtrum : undefined;
}

// Tag the current session with the operator identity.
export function identifyUser(id) {
  if (!id) return;
  try { dt()?.identifyUser?.(String(id)); } catch { /* RUM absent */ }
}

// Begin a custom user action; returns an opaque handle (or undefined).
export function startAction(name) {
  try { return dt()?.enterAction?.(name); } catch { return undefined; }
}

export function endAction(handle) {
  if (handle == null) return;
  try { dt()?.leaveAction?.(handle); } catch { /* RUM absent */ }
}

// Attach correlation properties to an in-flight action. Values are coerced to strings.
export function addActionProperties(handle, props = {}) {
  const api = dt();
  if (!api || handle == null) return;
  const strings = {};
  for (const [k, v] of Object.entries(props)) {
    if (v != null) strings[k] = String(v);
  }
  try { api.addActionProperties?.(handle, null, null, strings, null); } catch { /* RUM absent */ }
}

// Wrap a key flow as a single RUM action with a correlation property. `fn` may
// return a promise; the action closes when it settles.
export function trackAction(name, props, fn) {
  const handle = startAction(name);
  if (props) addActionProperties(handle, props);
  try {
    const result = typeof fn === 'function' ? fn() : undefined;
    if (result && typeof result.then === 'function') {
      return result.finally(() => endAction(handle));
    }
    endAction(handle);
    return result;
  } catch (err) {
    reportError(err);
    endAction(handle);
    throw err;
  }
}

export function reportError(error) {
  try {
    dt()?.reportCustomError?.(error?.name || 'error', String(error?.message || error));
  } catch { /* RUM absent */ }
}

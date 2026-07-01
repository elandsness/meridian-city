// Screen/module registry (public-portal). Maps a stable screen id to its route,
// default nav label, and component. `config.screens.public` selects which screens
// mount and in what order; per-screen {label, icon} overrides and terminology t()
// re-skin the labels. This is the seam the Phase 7 generic renderer plugs into.
import Home from '../pages/Home.jsx'
import ServiceRequests from '../pages/ServiceRequests.jsx'
import NewRequest from '../pages/NewRequest.jsx'
import RequestDetail from '../pages/RequestDetail.jsx'
import Store from '../pages/Store.jsx'
import Orders from '../pages/Orders.jsx'
import Billing from '../pages/Billing.jsx'
import Messages from '../pages/Messages.jsx'
import MyJourney from '../pages/MyJourney.jsx'

// `protected` gates the route behind auth; `termKey` (optional) pulls the nav label
// from the terminology map so it re-skins per industry. `subRoutes` are child paths
// (detail/new) that mount whenever the parent screen is active.
export const SCREENS = {
  home: { path: '/', label: 'Home', component: Home, protected: false },
  'my-journey': { path: '/my-journey', label: 'My Journey', icon: '🧳', component: MyJourney, protected: false },
  'service-requests': {
    path: '/service-requests',
    label: 'Service requests',
    termKey: 'requestPlural',
    component: ServiceRequests,
    protected: true,
    subRoutes: [
      { path: 'new', component: NewRequest },
      { path: ':id', component: RequestDetail },
    ],
  },
  store: {
    path: '/store',
    label: 'City store',
    component: Store,
    protected: true,
    subRoutes: [{ path: 'orders', component: Orders }],
  },
  billing: { path: '/billing', label: 'Pay bills', component: Billing, protected: true },
  messages: { path: '/messages', label: 'Messages', component: Messages, protected: true },
}

// Resolve the ordered, active screens for a config: applies per-screen label/icon
// overrides and terminology. Unknown ids are ignored; an absent list falls back to
// the full registry (so the default config = today's app).
export function getActiveScreens(config) {
  const list = config?.screens?.public ?? Object.keys(SCREENS)
  const term = (key, fallback) => config?.terminology?.[key] ?? fallback
  return list
    .map((item) => (typeof item === 'string' ? { id: item } : item))
    .filter((it) => it && SCREENS[it.id])
    .map((it) => {
      const def = SCREENS[it.id]
      return {
        id: it.id,
        path: def.path,
        component: def.component,
        protected: def.protected,
        subRoutes: def.subRoutes || [],
        label: it.label ?? (def.termKey ? term(def.termKey, def.label) : def.label),
      }
    })
}

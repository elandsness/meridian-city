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
import EntityListPage from '../components/entity/EntityListPage.jsx'
import EntityDetailPage from '../components/entity/EntityDetailPage.jsx'
import EntityMapPage from '../components/entity/EntityMapPage.jsx'
import EntityAnalyticsPage from '../components/entity/EntityAnalyticsPage.jsx'
import EntityJourneyPage from '../components/entity/EntityJourneyPage.jsx'
import StatusMapPage from '../components/entity/StatusMapPage.jsx'

// Generic entity-template registry (generic-entity-engine initiative). A
// screens.public entry of the form {id, template, entityType, ...} resolves
// through here instead of the static SCREENS map above -- see
// docs/industry-config.schema.json's third screenList branch.
const TEMPLATES = {
  'entity-list': EntityListPage,
  'entity-detail': EntityDetailPage,
  'entity-map': EntityMapPage,
  'entity-analytics': EntityAnalyticsPage,
  'entity-journey': EntityJourneyPage,
  'status-map': StatusMapPage,
}

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
// the full registry (so the default config = today's app). Strictly additive:
// a config entry with a `template` key resolves through TEMPLATES instead of the
// static SCREENS map, but App.jsx's route-building never changes -- it still
// only ever sees {id, path, component, protected, subRoutes}.
export function getActiveScreens(config) {
  const list = config?.screens?.public ?? Object.keys(SCREENS)
  const term = (key, fallback) => config?.terminology?.[key] ?? fallback
  return list
    .map((item) => (typeof item === 'string' ? { id: item } : item))
    .filter((it) => it && (it.template ? TEMPLATES[it.template] : SCREENS[it.id]))
    .map((it) => {
      if (it.template) {
        const Template = TEMPLATES[it.template]
        return {
          id: it.id,
          path: `/${it.id}`,
          component: () => <Template {...it} />,
          protected: true,
          subRoutes: [],
          label: it.label ?? it.id,
          icon: it.icon,
        }
      }
      const def = SCREENS[it.id]
      return {
        id: it.id,
        path: def.path,
        component: def.component,
        protected: def.protected,
        subRoutes: def.subRoutes || [],
        // Previously dropped on the floor here (Layout.jsx never rendered it,
        // unlike ops-dashboard's equivalent) -- wiring it through now that the
        // catalog is growing makes per-screen icon overrides actually work.
        icon: it.icon ?? def.icon,
        label: it.label ?? (def.termKey ? term(def.termKey, def.label) : def.label),
      }
    })
}

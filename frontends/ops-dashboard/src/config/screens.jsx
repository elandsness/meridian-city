// Screen/module registry (ops-dashboard). See public-portal/src/config/screens.jsx
// for the pattern. `config.screens.ops` selects + orders the sidebar screens; all
// ops screens are auth-gated via the Layout route, so no per-screen `protected`.
import Overview from '../pages/Overview.jsx';
import IoTPage from '../pages/IoTPage.jsx';
import IncidentsPage from '../pages/IncidentsPage.jsx';
import IncidentDetail from '../pages/IncidentDetail.jsx';
import RequestQueue from '../pages/RequestQueue.jsx';
import BusinessAnalytics from '../pages/BusinessAnalytics.jsx';
import DemoControl from '../pages/DemoControl.jsx';
import FlightBoard from '../pages/FlightBoard.jsx';
import EntityListPage from '../components/entity/EntityListPage.jsx';
import EntityDetailPage from '../components/entity/EntityDetailPage.jsx';
import EntityMapPage from '../components/entity/EntityMapPage.jsx';
import EntityAnalyticsPage from '../components/entity/EntityAnalyticsPage.jsx';
import EntityJourneyPage from '../components/entity/EntityJourneyPage.jsx';
import StatusMapPage from '../components/entity/StatusMapPage.jsx';

// Generic entity-template registry (generic-entity-engine initiative). A
// screens.ops entry of the form {id, template, entityType, ...} resolves
// through here instead of the static SCREENS map above -- see
// docs/industry-config.schema.json's third screenList branch.
const TEMPLATES = {
  'entity-list': EntityListPage,
  'entity-detail': EntityDetailPage,
  'entity-map': EntityMapPage,
  'entity-analytics': EntityAnalyticsPage,
  'entity-journey': EntityJourneyPage,
  'status-map': StatusMapPage,
};

export const SCREENS = {
  overview: { path: '/overview', label: 'Overview', icon: '📊', component: Overview },
  'flight-board': { path: '/flight-board', label: 'Flight Board', icon: '✈️', component: FlightBoard },
  iot: { path: '/iot', label: 'IoT Fleet', icon: '🌐', component: IoTPage },
  incidents: {
    path: '/incidents',
    label: 'Incidents',
    icon: '🚨',
    component: IncidentsPage,
    subRoutes: [{ path: ':id', component: IncidentDetail }],
  },
  requests: { path: '/requests', label: 'Requests', icon: '📋', component: RequestQueue },
  analytics: { path: '/analytics', label: 'Business Analytics', icon: '📈', component: BusinessAnalytics },
  'demo-control': { path: '/demo-control', label: 'Demo Control', icon: '🎛', component: DemoControl },
};

// Resolve the ordered, active ops screens for a config: applies per-screen
// label/icon overrides and terminology. Unknown ids are ignored; an absent list
// falls back to the full registry (default = today's dashboard).
export function getActiveScreens(config) {
  const list = config?.screens?.ops ?? Object.keys(SCREENS);
  const term = (key, fallback) => config?.terminology?.[key] ?? fallback;
  return list
    .map((item) => (typeof item === 'string' ? { id: item } : item))
    .filter((it) => it && (it.template ? TEMPLATES[it.template] : SCREENS[it.id]))
    .map((it) => {
      if (it.template) {
        const Template = TEMPLATES[it.template];
        return {
          id: it.id,
          path: `/${it.id}`,
          component: () => <Template {...it} />,
          icon: it.icon,
          subRoutes: [],
          label: it.label ?? it.id,
        };
      }
      const def = SCREENS[it.id];
      return {
        id: it.id,
        path: def.path,
        component: def.component,
        icon: it.icon ?? def.icon,
        subRoutes: def.subRoutes || [],
        label: it.label ?? (def.termKey ? term(def.termKey, def.label) : def.label),
      };
    });
}

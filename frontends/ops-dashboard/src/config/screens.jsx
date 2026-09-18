1|// Screen/module registry (ops-dashboard). See public-portal/src/config/screens.jsx
2|// for the pattern. `config.screens.ops` selects + orders the sidebar screens; all
3|// ops screens are auth-gated via the Layout route, so no per-screen `protected`.
4|import Overview from '../pages/Overview.jsx';
5|import IoTPage from '../pages/IoTPage.jsx';
6|import IncidentsPage from '../pages/IncidentsPage.jsx';
7|import IncidentDetail from '../pages/IncidentDetail.jsx';
8|import RequestQueue from '../pages/RequestQueue.jsx';
9|import BusinessAnalytics from '../pages/BusinessAnalytics.jsx';
10|import DemoControl from '../pages/DemoControl.jsx';
12|import EntityListPage from '../components/entity/EntityListPage.jsx';
13|import EntityGridListPage from '../components/entity/EntityGridListPage.jsx';
14|import EntityDetailPage from '../components/entity/EntityDetailPage.jsx';
15|import EntityMapPage from '../components/entity/EntityMapPage.jsx';
16|import EntityAnalyticsPage from '../components/entity/EntityAnalyticsPage.jsx';
17|import EntityJourneyPage from '../components/entity/EntityJourneyPage.jsx';
18|import StatusMapPage from '../components/entity/StatusMapPage.jsx';
19|
20|// Generic entity-template registry (generic-entity-engine initiative). A
21|// screens.ops entry of the form {id, template, entityType, ...} resolves
22|// through here instead of the static SCREENS map above -- see
23|// docs/industry-config.schema.json's third screenList branch.
24|const TEMPLATES = {
25|  'entity-list': EntityListPage,
26|  'entity-grid-list': EntityGridListPage,
27|  'entity-detail': EntityDetailPage,
28|  'entity-map': EntityMapPage,
29|  'entity-analytics': EntityAnalyticsPage,
30|  'entity-journey': EntityJourneyPage,
31|  'status-map': StatusMapPage,
32|};
33|
34|export const SCREENS = {
35|  overview: { path: '/overview', label: 'Overview', icon: '📊', component: Overview },
36|  iot: { path: '/iot', label: 'IoT Fleet', icon: '🌐', component: IoTPage },
37|  incidents: {
38|    path: '/incidents',
39|    label: 'Incidents',
40|    icon: '🚨',
41|    component: IncidentsPage,
42|    subRoutes: [{ path: ':id', component: IncidentDetail }],
43|  },
44|  requests: { path: '/requests', label: 'Requests', icon: '📋', component: RequestQueue },
45|  analytics: { path: '/analytics', label: 'Business Analytics', icon: '📈', component: BusinessAnalytics },
46|  'demo-control': { path: '/demo-control', label: 'Demo Control', icon: '<0xF0><0x9F><0x8E><0x9B>', component: DemoControl },
47|};
48|
49|// Resolve the ordered, active ops screens for a config: applies per-screen
50|// label/icon overrides and terminology. Unknown ids are ignored; an absent list
51|// falls back to the full registry (default = today's dashboard).
52|export function getActiveScreens(config) {
53|  const list = config?.screens?.ops ?? Object.keys(SCREENS);
54|  const term = (key, fallback) => config?.terminology?.[key] ?? fallback;
55|  return list
56|    .map((item) => (typeof item === 'string' ? { id: item } : item))
57|    .filter((it) => it && (it.template ? TEMPLATES[it.template] : SCREENS[it.id]))
58|    .map((it) => {
59|      if (it.template) {
60|        const Template = TEMPLATES[it.template];
61|        return {
62|          id: it.id,
63|          path: `/${it.id}`,
64|          component: () => <Template {...it} />,
65|          icon: it.icon,
66|          subRoutes: [],
67|          label: it.label ?? it.id,
68|        };
69|      }
70|      const def = SCREENS[it.id];
71|      return {
72|        id: it.id,
73|        path: def.path,
74|        component: def.component,
75|        icon: it.icon ?? def.icon,
76|        subRoutes: def.subRoutes || [],
77|        label: it.label ?? (def.termKey ? term(def.termKey, def.label) : def.label),
78|      };
79|    });
80|}
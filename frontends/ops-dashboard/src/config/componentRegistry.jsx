// Generic component registry — maps component IDs to React components.
// The PageComposer reads this registry to render modules from the industry
// config. Adding a new component means: implement the component, then add it
// to this map. Zero config changes needed.

import OpsOverview from '../components/home/OpsOverview'
import FlightSummary from '../components/home/FlightSummary'
import KpiTile from '../components/home/KpiTile'
import IncidentBadge from '../components/home/IncidentBadge'
import FunnelChart from '../components/home/FunnelChart'
import EntityListPage from '../components/entity/EntityListPage'
import EntityDetailPage from '../components/entity/EntityDetailPage'
import EntityMapPage from '../components/entity/EntityMapPage'
import EntityAnalyticsPage from '../components/entity/EntityAnalyticsPage'
import EntityJourneyPage from '../components/entity/EntityJourneyPage'
import StatusMapPage from '../components/entity/StatusMapPage'

export const COMPONENT_REGISTRY = {
  // Ops home modules (configurable via home.ops)
  'ops-overview': OpsOverview,
  'flight-summary': FlightSummary,
  'kpi-tile': KpiTile,
  'incident-badge': IncidentBadge,
  'funnel-chart': FunnelChart,

  // Entity pages (configurable via entity definitions)
  'entity-list': EntityListPage,
  'entity-detail': EntityDetailPage,
  'entity-map': EntityMapPage,
  'entity-analytics': EntityAnalyticsPage,
  'entity-journey': EntityJourneyPage,
  'status-map': StatusMapPage,
}

export default COMPONENT_REGISTRY

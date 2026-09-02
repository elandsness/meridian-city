// Generic component registry — maps component IDs to React components.
// This allows the PageComposer to compose pages from a library of generic
// components, enabling zero-code reskinning via the industry config DSL.
//
// The registry is the contract between the config layer and the UI layer:
// the config specifies which component IDs to use, and the registry resolves
// them to actual React components.

import WeatherWidget from '../components/WeatherWidget'
import NewsTicker from '../components/NewsTicker'
import TransitPanel from '../components/TransitPanel'
import ChatWidget from '../components/ChatWidget'
import EntityListPage from '../components/entity/EntityListPage'
import EntityDetailPage from '../components/entity/EntityDetailPage'
import EntityMapPage from '../components/entity/EntityMapPage'
import EntityAnalyticsPage from '../components/entity/EntityAnalyticsPage'
import EntityJourneyPage from '../components/entity/EntityJourneyPage'
import StatusMapPage from '../components/entity/StatusMapPage'

// Home-page components (legacy homeModules keys)
import OpsOverview from '../components/home/OpsOverview'
import FlightSummary from '../components/home/FlightSummary'

// Widget templates from the industry-config schema's screenList $defs
// (docs/industry-config.schema.json) -- keyed by the schema's own `template`
// enum values, not the legacy homeModules ids above.
import Ticker from '../components/home/Ticker'
import Announcements from '../components/home/Announcements'
import HomeWeatherWidget from '../components/home/WeatherWidget'
import ClockWidget from '../components/home/ClockWidget'
import EntitySummaryCard from '../components/home/EntitySummaryCard'
import EntityKpiRow from '../components/home/EntityKpiRow'
import ActivityFeed from '../components/home/ActivityFeed'

export const COMPONENT_REGISTRY = {
  // Generic components
  'weather': WeatherWidget,
  'news-ticker': NewsTicker,
  'transit-map': TransitPanel,
  'chat-widget': ChatWidget,
  'entity-list': EntityListPage,
  'entity-detail': EntityDetailPage,
  'entity-map': EntityMapPage,
  'entity-analytics': EntityAnalyticsPage,
  'entity-journey': EntityJourneyPage,
  'status-map': StatusMapPage,

  // Home-page components (legacy homeModules keys)
  'ops-overview': OpsOverview,
  'flight-summary': FlightSummary,

  // Schema `template:` widget keys
  'ticker': Ticker,
  'announcements': Announcements,
  'weather-widget': HomeWeatherWidget,
  'clock-widget': ClockWidget,
  'entity-summary-card': EntitySummaryCard,
  'entity-kpi-row': EntityKpiRow,
  'activity-feed': ActivityFeed,
}

export default COMPONENT_REGISTRY

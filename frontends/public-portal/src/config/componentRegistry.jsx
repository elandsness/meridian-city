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
import CityHome from '../components/home/CityHome'
import QuickActions from '../components/home/QuickActions'
import FlightStatus from '../components/home/FlightStatus'
import AirfieldMapCard from '../components/home/AirfieldMapCard'
import MyJourneyCard from '../components/home/MyJourneyCard'

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
  'city-home': CityHome,
  'quick-actions': QuickActions,
  'flight-status': FlightStatus,
  'airfield-map': AirfieldMapCard,
  'my-journey': MyJourneyCard,
}

export default COMPONENT_REGISTRY

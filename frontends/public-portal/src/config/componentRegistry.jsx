// Generic component registry — maps component IDs to React components.
// The PageComposer reads this registry to render modules from the industry
// config. Adding a new component means: implement the component, then add it
// to this map. Zero config changes needed.

import WeatherTile from '../components/WeatherTile'
import NewsTicker from '../components/NewsTicker'
import TransitPanel from '../components/TransitPanel'
import ChatWidget from '../components/ChatWidget'
import CityHome from '../components/home/CityHome'
import FlightStatus from '../components/home/FlightStatus'
import QuickActions from '../components/home/QuickActions'
import MyJourneyCard from '../components/home/MyJourneyCard'
import AirfieldMapCard from '../components/home/AirfieldMapCard'
import EntityListPage from '../components/entity/EntityListPage'
import EntityDetailPage from '../components/entity/EntityDetailPage'
import EntityMapPage from '../components/entity/EntityMapPage'
import EntityAnalyticsPage from '../components/entity/EntityAnalyticsPage'
import EntityJourneyPage from '../components/entity/EntityJourneyPage'
import StatusMapPage from '../components/entity/StatusMapPage'

export const COMPONENT_REGISTRY = {
  // Home page modules (configurable via home.public)
  'city-home': CityHome,
  'weather': WeatherTile,
  'news-ticker': NewsTicker,
  'transit-map': TransitPanel,
  'chat-widget': ChatWidget,
  'flight-status': FlightStatus,
  'quick-actions': QuickActions,
  'my-journey': MyJourneyCard,
  'airfield-map': AirfieldMapCard,

  // Entity pages (configurable via entity definitions)
  'entity-list': EntityListPage,
  'entity-detail': EntityDetailPage,
  'entity-map': EntityMapPage,
  'entity-analytics': EntityAnalyticsPage,
  'entity-journey': EntityJourneyPage,
  'status-map': StatusMapPage,
}

export default COMPONENT_REGISTRY

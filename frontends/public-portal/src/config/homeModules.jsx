// Home-module registry. `config.home.public` (from the industry config) selects and orders
// the modules that compose the portal home page; an absent list falls back to the city
// bundle so the default app is unchanged. This is the home-page analogue of screens.jsx —
// the seam a config-authored industry plugs its home layout into.
import CityHome from '../components/home/CityHome.jsx'
import QuickActions from '../components/home/QuickActions.jsx'
import TransitMapCard from '../components/home/TransitMapCard.jsx'
import FlightStatus from '../components/home/FlightStatus.jsx'
import AirfieldMapCard from '../components/home/AirfieldMapCard.jsx'
import MyJourneyCard from '../components/home/MyJourneyCard.jsx'
import WelcomeHero from '../components/home/WelcomeHero.jsx'
import Announcements from '../components/home/Announcements.jsx'
import ChatTeaser from '../components/home/ChatTeaser.jsx'
import EntityMapCard from '../components/entity/EntityMapCard.jsx'
import NewsTicker from '../components/home/NewsTicker.jsx'
import WeatherWidget from '../components/home/WeatherWidget.jsx'
import StockTicker from '../components/home/StockTicker.jsx'
import SportsTicker from '../components/home/SportsTicker.jsx'
import ClockWidget from '../components/home/ClockWidget.jsx'
import EntitySummaryCard from '../components/home/EntitySummaryCard.jsx'

// Static modules (no config props needed).
export const HOME_MODULES = {
  'city-home': CityHome,
  'transit-map': TransitMapCard,
  'quick-actions': QuickActions,
  'flight-status': FlightStatus,
  'airfield-map': AirfieldMapCard,
  'my-journey': MyJourneyCard,
  'welcome-hero': WelcomeHero,
  'chat-teaser': ChatTeaser,
}

// Template modules (receive all config props spread onto them — used via
// { id, template, ...props } in config.home.public).
const TEMPLATES = {
  'entity-map': EntityMapCard,
  'news-ticker': NewsTicker,
  'weather-widget': WeatherWidget,
  'stock-ticker': StockTicker,
  'sports-ticker': SportsTicker,
  'clock-widget': ClockWidget,
  'announcements': Announcements,
  'entity-summary-card': EntitySummaryCard,
}

export function getActiveHomeModules(config) {
  const list = config?.home?.public ?? ['city-home', 'quick-actions']
  return list
    .map((item) => (typeof item === 'string' ? { id: item } : item))
    .filter((it) => it && (it.template ? TEMPLATES[it.template] : HOME_MODULES[it.id]))
    .map((it) => {
      if (it.template) {
        const Template = TEMPLATES[it.template]
        return { id: it.id, Component: () => <Template {...it} /> }
      }
      return { id: it.id, Component: HOME_MODULES[it.id] }
    })
}

// Home-module registry. `config.home.public` (from the industry config) selects and orders
// the modules that compose the portal home page; an absent list falls back to the city
// bundle so the default app is unchanged. This is the home-page analogue of screens.jsx —
// the seam a config-authored industry plugs its home layout into.
import CityHome from '../components/home/CityHome.jsx'
import QuickActions from '../components/home/QuickActions.jsx'
import FlightStatus from '../components/home/FlightStatus.jsx'
import AirfieldMapCard from '../components/home/AirfieldMapCard.jsx'
import MyJourneyCard from '../components/home/MyJourneyCard.jsx'

export const HOME_MODULES = {
  'city-home': CityHome,
  'quick-actions': QuickActions,
  'flight-status': FlightStatus,
  'airfield-map': AirfieldMapCard,
  'my-journey': MyJourneyCard,
}

export function getActiveHomeModules(config) {
  const list = config?.home?.public ?? ['city-home', 'quick-actions']
  return list
    .map((item) => (typeof item === 'string' ? { id: item } : item))
    .filter((it) => it && HOME_MODULES[it.id])
    .map((it) => ({ id: it.id, Component: HOME_MODULES[it.id] }))
}

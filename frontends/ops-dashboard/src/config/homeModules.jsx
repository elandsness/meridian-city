// Ops-home module registry. `config.home.ops` selects and orders the modules that
// compose the ops-dashboard landing (Overview); an absent list falls back to the
// standard ops overview so the default dashboard is unchanged. Mirrors the public
// portal's homeModules.jsx and the screen registry pattern.
import OpsOverview from '../components/home/OpsOverview.jsx';
import FlightSummary from '../components/home/FlightSummary.jsx';
import EntityMapCard from '../components/entity/EntityMapCard.jsx';
import StatusMapPage from '../components/entity/StatusMapPage.jsx';
import WelcomeHero from '../components/home/WelcomeHero.jsx';
import Announcements from '../components/home/Announcements.jsx';
import Ticker from '../components/home/Ticker.jsx';
import WeatherWidget from '../components/home/WeatherWidget.jsx';
import ClockWidget from '../components/home/ClockWidget.jsx';
import EntitySummaryCard from '../components/home/EntitySummaryCard.jsx';
import EntityKpiRow from '../components/home/EntityKpiRow.jsx';
import ActivityFeed from '../components/home/ActivityFeed.jsx';
import IotAlertsCard from '../components/home/IotAlertsCard.jsx';

// Static modules (no config props needed — component reads config internally or has
// sensible defaults that don't require per-instance configuration).
export const HOME_MODULES = {
  'ops-overview': OpsOverview,
  'flight-summary': FlightSummary,
  'welcome-hero': WelcomeHero,
  'iot-alerts-card': IotAlertsCard,
};

// Template modules (receive all config props spread onto them — used via
// { id, template, ...props } in config.home.ops).
const TEMPLATES = {
  'entity-map': EntityMapCard,
  'status-map': StatusMapPage,
  'ticker': Ticker,
  'weather-widget': WeatherWidget,
  'clock-widget': ClockWidget,
  'announcements': Announcements,
  'entity-summary-card': EntitySummaryCard,
  'entity-kpi-row': EntityKpiRow,
  'activity-feed': ActivityFeed,
};

export function getActiveHomeModules(config) {
  const list = config?.home?.ops ?? ['ops-overview'];
  return list
    .map((item) => (typeof item === 'string' ? { id: item } : item))
    .filter((it) => it && (it.template ? TEMPLATES[it.template] : HOME_MODULES[it.id]))
    .map((it) => {
      if (it.template) {
        const Template = TEMPLATES[it.template];
        return { id: it.id, Component: () => <Template {...it} /> };
      }
      return { id: it.id, Component: HOME_MODULES[it.id] };
    });
}

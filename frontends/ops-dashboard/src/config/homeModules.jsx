// Ops-home module registry. `config.home.ops` selects and orders the modules that
// compose the ops-dashboard landing (Overview); an absent list falls back to the
// standard ops overview so the default dashboard is unchanged. Mirrors the public
// portal's homeModules.jsx and the screen registry pattern.
import OpsOverview from '../components/home/OpsOverview.jsx';
import FlightSummary from '../components/home/FlightSummary.jsx';

export const HOME_MODULES = {
  'ops-overview': OpsOverview,
  'flight-summary': FlightSummary,
};

export function getActiveHomeModules(config) {
  const list = config?.home?.ops ?? ['ops-overview'];
  return list
    .map((item) => (typeof item === 'string' ? { id: item } : item))
    .filter((it) => it && HOME_MODULES[it.id])
    .map((it) => ({ id: it.id, Component: HOME_MODULES[it.id] }));
}

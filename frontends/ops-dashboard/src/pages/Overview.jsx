import { useConfig } from '../config/ConfigContext';
import { getActiveHomeModules } from '../config/homeModules.jsx';

// The ops landing page: a heading + a config-selected list of ops-home modules
// (see homeModules.jsx). Default (city) renders the standard ops overview; the airport
// leads with a live flight summary.
export default function Overview() {
  const cfg = useConfig();
  const modules = getActiveHomeModules(cfg);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Overview</h1>
      {modules.map(({ id, Component }) => (
        <Component key={id} />
      ))}
    </div>
  );
}

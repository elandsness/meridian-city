import { useConfig } from '../config/ConfigContext';
import PageComposer from '../components/PageComposer';

// The ops landing page: a heading + a PageComposer that renders modules from the
// industry config. Default (city) renders the standard ops overview; the airport
// leads with a live flight summary.
export default function Overview() {
  const cfg = useConfig();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Overview</h1>
      <PageComposer pageId="ops" config={cfg} />
    </div>
  );
}

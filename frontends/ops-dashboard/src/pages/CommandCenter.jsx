import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCommandCenterStatus } from '../api/commandCenter.js';
import Card from '../ui/Card.jsx';

function StatTile({ label, value, tone = 'text-gray-100' }) {
  return (
    <div className="bg-gray-800 rounded-lg p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-2xl font-bold mt-0.5 ${tone}`}>{value}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Business-flow health
// ---------------------------------------------------------------------------
function FlowCard({ flow }) {
  const states = Object.entries(flow.byState ?? {});
  const hasErrors = (flow.errorCount ?? 0) > 0;

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-white">{flow.label}</p>
        {hasErrors && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 flex-shrink-0">
            {flow.errorCount} error{flow.errorCount === 1 ? '' : 's'}
          </span>
        )}
      </div>
      <p className="text-3xl font-bold text-cyan-400 mt-2">{flow.total}</p>
      <p className="text-xs text-gray-500">in flight</p>
      {states.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-700 flex flex-wrap gap-x-3 gap-y-1">
          {states.map(([state, count]) => (
            <span key={state} className="text-xs text-gray-400">
              <span className="text-gray-300 tabular-nums">{count}</span> {state}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function BusinessFlowsSection({ flows }) {
  return (
    <Card title="Business Flows">
      {flows.length === 0 ? (
        <p className="text-gray-500 text-sm">No flow data yet — start traffic to generate activity.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {flows.map((flow) => (
            <FlowCard key={flow.entityType} flow={flow} />
          ))}
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Traffic
// ---------------------------------------------------------------------------
function TrafficSection({ traffic }) {
  const running = traffic?.running ?? traffic?.status === 'running';
  const rpm = traffic?.rpm_current ?? traffic?.rate_rpm ?? traffic?.rpm ?? 0;
  const completed = traffic?.journeys_completed ?? null;
  const journeys = Array.isArray(traffic?.journeys) ? traffic.journeys : [];

  return (
    <Card title="Traffic">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatTile
          label="Traffic bot"
          value={running ? 'Running' : 'Stopped'}
          tone={running ? 'text-green-400' : 'text-gray-400'}
        />
        <StatTile label="Requests / min" value={Math.round(rpm)} tone="text-cyan-400" />
        <StatTile
          label="Journeys run"
          value={completed != null ? Number(completed).toLocaleString() : '—'}
          tone="text-cyan-400"
        />
      </div>
      {journeys.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-4 text-xs">
          <span className="text-gray-500">Journeys:</span>
          {journeys.map((j) => (
            <span
              key={j.name}
              title={typeof j.weight === 'number' ? `weight ${j.weight}` : undefined}
              className={j.enabled ? 'text-gray-300' : 'text-gray-600 line-through'}
            >
              {j.name}
            </span>
          ))}
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Active scenario + fault gates
// ---------------------------------------------------------------------------
function enabledGates(gatesByName) {
  return Object.entries(gatesByName ?? {}).filter(([, g]) => g?.enabled);
}

function FailureScenariosSection({ scenario, faultGates }) {
  const sources = Object.entries(faultGates ?? {});
  const activeGateCount = sources.reduce((n, [, gates]) => n + enabledGates(gates).length, 0);

  return (
    <Card title="Failure Scenarios">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs text-gray-500 uppercase tracking-wide">Active scenario:</span>
        {scenario ? (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30">
            ● {scenario.name}
          </span>
        ) : (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
            ● None
          </span>
        )}
      </div>

      {activeGateCount === 0 ? (
        <p className="text-gray-500 text-sm">No fault gates currently enabled.</p>
      ) : (
        <div className="space-y-3">
          {sources.map(([source, gates]) => {
            const active = enabledGates(gates);
            if (active.length === 0) return null;
            return (
              <div key={source}>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{source}</p>
                <div className="flex flex-wrap gap-2">
                  {active.map(([name, g]) => (
                    <span
                      key={name}
                      className="text-xs font-mono px-2 py-1 rounded bg-rose-500/10 text-rose-300 border border-rose-500/20"
                    >
                      {name} ({Math.round((g.rate ?? 0) * 100)}%)
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function CommandCenter() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['command-center'],
    queryFn: getCommandCenterStatus,
    refetchInterval: 10_000,
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Command Center</h1>
        <span className="flex items-center gap-1.5 text-xs text-green-400">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />Live
        </span>
      </div>

      {isLoading && <p className="text-gray-500 text-sm">Loading platform status…</p>}
      {error && <p className="text-rose-400 text-sm">Failed to load Command Center status</p>}

      {data && (
        <>
          <TrafficSection traffic={data.traffic} />
          <BusinessFlowsSection flows={Array.isArray(data.flows) ? data.flows : []} />
          <FailureScenariosSection scenario={data.scenario} faultGates={data.faultGates} />
        </>
      )}
    </div>
  );
}

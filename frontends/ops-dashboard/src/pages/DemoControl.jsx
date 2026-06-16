import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getDemoStatus,
  getScenarios,
  startScenario,
  resetActiveScenario,
  resetAll,
  getFaultStatus,
  injectFault,
  getFleetStatus,
  resizeFleet,
  injectAnomaly,
  clearAnomalies,
  getTrafficStatus,
  startTraffic,
  stopTraffic,
  burstTraffic,
} from '../api/demo.js';
import { getIncidents } from '../api/incidents.js';
import { DEMO_GUIDE } from '../data/demoGuide.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function StatusMsg({ result }) {
  if (!result) return null;
  if (result.ok) {
    return <span className="text-green-400 text-xs ml-2">✓ Done</span>;
  }
  return <span className="text-rose-400 text-xs ml-2">✗ Error: {result.error}</span>;
}

function SectionCard({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-800/30 transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="font-semibold text-white text-sm">{title}</span>
        <span className="text-gray-500 text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className="px-5 pb-5 space-y-4">{children}</div>}
    </div>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <div
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-5 rounded-full transition-colors ${
          checked ? 'bg-rose-500' : 'bg-gray-700'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </div>
      <span className="text-sm text-gray-300">{label}</span>
    </label>
  );
}

function FaultIndicator({ active }) {
  return (
    <span
      className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${
        active ? 'bg-rose-400 shadow-[0_0_6px_#f87171]' : 'bg-green-500'
      }`}
    />
  );
}

// ---------------------------------------------------------------------------
// Section 1: System Status
// ---------------------------------------------------------------------------
function SystemStatus({ status, onResetAll }) {
  const [confirm, setConfirm] = useState(false);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const activeScenario = status?.active_scenario?.name;

  async function handleResetAll() {
    if (!confirm) {
      setConfirm(true);
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      await onResetAll();
      setResult({ ok: true });
    } catch (err) {
      setResult({ ok: false, error: err.response?.data?.message ?? err.message });
    } finally {
      setLoading(false);
      setConfirm(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 uppercase tracking-wide">Active Scenario:</span>
        {activeScenario ? (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30">
            ● {activeScenario}
          </span>
        ) : (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
            ● No active scenario
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 ml-auto">
        {confirm && (
          <span className="text-xs text-rose-400">Are you sure? Click again to confirm.</span>
        )}
        <button
          onClick={handleResetAll}
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
        >
          {loading ? '…' : '⚠ Reset All'}
        </button>
        <StatusMsg result={result} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 2: Scenarios
// ---------------------------------------------------------------------------
function ScenariosCard({ activeScenarioId }) {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['scenarios'],
    queryFn: getScenarios,
    staleTime: 120_000,
  });

  const scenarios = data?.scenarios ?? [];
  const [loadingId, setLoadingId] = useState(null);
  const [results, setResults] = useState({});

  async function handleStart(id) {
    setLoadingId(id);
    setResults((r) => ({ ...r, [id]: null }));
    try {
      await startScenario(id);
      setResults((r) => ({ ...r, [id]: { ok: true } }));
      qc.invalidateQueries({ queryKey: ['demo-status'] });
    } catch (err) {
      setResults((r) => ({
        ...r,
        [id]: { ok: false, error: err.response?.data?.message ?? err.message },
      }));
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <SectionCard title="Demo Scenarios">
      {isLoading && <p className="text-gray-500 text-sm">Loading scenarios…</p>}
      {error && <p className="text-rose-400 text-sm">Failed to load scenarios</p>}
      <div className="space-y-3">
        {scenarios.map((sc) => {
          const isActive = activeScenarioId === sc.id;
          const loading = loadingId === sc.id;
          const result = results[sc.id];
          const durationLabel =
            sc.duration_seconds
              ? `Auto-reset: ${Math.round(sc.duration_seconds / 60)}m`
              : 'Manual reset';

          return (
            <div
              key={sc.id}
              className={`flex items-start justify-between gap-4 rounded-lg p-4 border transition-colors ${
                isActive
                  ? 'bg-orange-500/10 border-orange-500/30'
                  : 'bg-gray-800 border-gray-700'
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-white">{sc.name}</p>
                  {isActive && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{sc.description}</p>
                <p className="text-xs text-gray-600 mt-1">{durationLabel}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {!isActive && (
                  <button
                    onClick={() => handleStart(sc.id)}
                    disabled={loading || !!loadingId}
                    className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
                  >
                    {loading ? '…' : '▶ Activate'}
                  </button>
                )}
                <StatusMsg result={result} />
              </div>
            </div>
          );
        })}
        {!isLoading && scenarios.length === 0 && (
          <p className="text-gray-500 text-sm">No scenarios available</p>
        )}
      </div>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Section 3: Fault Injection
// ---------------------------------------------------------------------------
const FAULT_DEFS = [
  {
    id: 'ai-service',
    label: 'AI Service — LLM Latency',
    enableKey: 'llm_latency_enabled',
    secKey: 'llm_latency_seconds',
    secMin: 1,
    secMax: 30,
    secDefault: 10,
  },
  {
    id: 'citizen-service',
    label: 'Citizen Service — DB Slowdown',
    enableKey: 'db_slowdown_enabled',
    secKey: 'db_slowdown_seconds',
    secMin: 1,
    secMax: 10,
    secDefault: 3,
  },
  {
    id: 'analytics-service',
    label: 'Analytics Service — Memory Pressure',
    enableKey: 'memory_pressure_enabled',
    secKey: null,
  },
  {
    id: 'telemetry-processor',
    label: 'Telemetry Processor — Kafka Pause',
    enableKey: 'kafka_pause_enabled',
    secKey: null,
  },
];

function FaultRow({ def, faultStatus }) {
  const svcStatus = faultStatus?.faults?.[def.id] ?? {};
  const currentEnabled = svcStatus[def.enableKey] ?? false;
  const currentSecs = svcStatus[def.secKey] ?? def.secDefault ?? 5;

  const [enabled, setEnabled] = useState(currentEnabled);
  const [secs, setSecs] = useState(currentSecs);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setEnabled(svcStatus[def.enableKey] ?? false);
    if (def.secKey) setSecs(svcStatus[def.secKey] ?? def.secDefault ?? 5);
  }, [faultStatus]);

  async function apply(newEnabled, newSecs) {
    setLoading(true);
    setResult(null);
    const body = { [def.enableKey]: newEnabled };
    if (def.secKey) body[def.secKey] = newSecs;
    try {
      await injectFault(def.id, body);
      setResult({ ok: true });
    } catch (err) {
      setResult({ ok: false, error: err.response?.data?.message ?? err.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-4 py-3 border-b border-gray-800 last:border-0">
      <FaultIndicator active={enabled} />
      <Toggle
        checked={enabled}
        label={def.label}
        onChange={(val) => {
          setEnabled(val);
          apply(val, secs);
        }}
      />
      {def.secKey && (
        <div className="flex items-center gap-2 ml-auto">
          <label className="text-xs text-gray-500">{secs}s</label>
          <input
            type="range"
            min={def.secMin}
            max={def.secMax}
            value={secs}
            onChange={(e) => setSecs(Number(e.target.value))}
            onMouseUp={() => enabled && apply(enabled, secs)}
            className="w-28 accent-cyan-400"
          />
          <button
            onClick={() => apply(enabled, secs)}
            disabled={loading}
            className="text-xs text-gray-500 hover:text-cyan-400 transition-colors"
          >
            Apply
          </button>
        </div>
      )}
      {loading && <span className="text-gray-500 text-xs">…</span>}
      <StatusMsg result={result} />
    </div>
  );
}

function FaultCard() {
  const { data: faultStatus, isLoading } = useQuery({
    queryKey: ['fault-status'],
    queryFn: getFaultStatus,
    refetchInterval: 10_000,
  });

  return (
    <SectionCard title="Failure Injection">
      {isLoading ? (
        <p className="text-gray-500 text-sm">Loading fault state…</p>
      ) : (
        <div>
          {FAULT_DEFS.map((def) => (
            <FaultRow key={def.id} def={def} faultStatus={faultStatus} />
          ))}
        </div>
      )}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Section 4: Fleet Management
// ---------------------------------------------------------------------------
function FleetCard() {
  const qc = useQueryClient();
  const { data: fleetStatus, isLoading } = useQuery({
    queryKey: ['fleet-status'],
    queryFn: getFleetStatus,
    refetchInterval: 10_000,
  });

  const [vehicles, setVehicles] = useState(30);
  const [buildings, setBuildings] = useState(15);
  const [machines, setMachines] = useState(10);
  const [resizeResult, setResizeResult] = useState(null);
  const [resizeLoading, setResizeLoading] = useState(false);

  const [anomalyCategory, setAnomalyCategory] = useState('vehicle');
  const [anomalyDeviceId, setAnomalyDeviceId] = useState('');
  const [anomalyType, setAnomalyType] = useState('generic');
  const [anomalyResult, setAnomalyResult] = useState(null);
  const [anomalyLoading, setAnomalyLoading] = useState(false);
  const [clearResult, setClearResult] = useState(null);
  const [clearLoading, setClearLoading] = useState(false);

  useEffect(() => {
    if (fleetStatus) {
      setVehicles(fleetStatus.vehicles ?? 30);
      setBuildings(fleetStatus.buildings ?? 15);
      setMachines(fleetStatus.machines ?? 10);
    }
  }, [fleetStatus]);

  async function handleResize() {
    setResizeLoading(true);
    setResizeResult(null);
    try {
      await resizeFleet({ vehicles, buildings, machines });
      setResizeResult({ ok: true });
      qc.invalidateQueries({ queryKey: ['fleet-status'] });
    } catch (err) {
      setResizeResult({ ok: false, error: err.response?.data?.message ?? err.message });
    } finally {
      setResizeLoading(false);
    }
  }

  async function handleInjectAnomaly() {
    if (!anomalyDeviceId.trim()) return;
    setAnomalyLoading(true);
    setAnomalyResult(null);
    try {
      await injectAnomaly({
        category: anomalyCategory,
        device_id: anomalyDeviceId.trim(),
        anomaly_type: anomalyType,
      });
      setAnomalyResult({ ok: true });
    } catch (err) {
      setAnomalyResult({ ok: false, error: err.response?.data?.message ?? err.message });
    } finally {
      setAnomalyLoading(false);
    }
  }

  async function handleClearAnomalies() {
    setClearLoading(true);
    setClearResult(null);
    try {
      await clearAnomalies();
      setClearResult({ ok: true });
    } catch (err) {
      setClearResult({ ok: false, error: err.response?.data?.message ?? err.message });
    } finally {
      setClearLoading(false);
    }
  }

  function NumberInput({ label, value, setValue, min, max }) {
    return (
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500">{label}</label>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setValue((v) => Math.max(min, v - 1))}
            className="w-7 h-7 rounded bg-gray-700 hover:bg-gray-600 text-white text-sm transition-colors"
          >
            −
          </button>
          <input
            type="number"
            value={value}
            min={min}
            max={max}
            onChange={(e) => setValue(Math.min(max, Math.max(min, Number(e.target.value))))}
            className="w-16 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-sm text-center focus:outline-none focus:border-cyan-500"
          />
          <button
            onClick={() => setValue((v) => Math.min(max, v + 1))}
            className="w-7 h-7 rounded bg-gray-700 hover:bg-gray-600 text-white text-sm transition-colors"
          >
            +
          </button>
        </div>
      </div>
    );
  }

  return (
    <SectionCard title="IoT Fleet Management">
      {/* Current counts */}
      {isLoading ? (
        <p className="text-gray-500 text-sm">Loading fleet status…</p>
      ) : (
        <div className="flex gap-4 text-xs text-gray-400">
          <span>Current: <span className="text-blue-400">{fleetStatus?.vehicles ?? '?'} vehicles</span></span>
          <span><span className="text-green-400">{fleetStatus?.buildings ?? '?'} buildings</span></span>
          <span><span className="text-orange-400">{fleetStatus?.machines ?? '?'} machines</span></span>
        </div>
      )}

      {/* Resize controls */}
      <div className="flex flex-wrap items-end gap-4">
        <NumberInput label="Vehicles (1–100)" value={vehicles} setValue={setVehicles} min={1} max={100} />
        <NumberInput label="Buildings (1–50)" value={buildings} setValue={setBuildings} min={1} max={50} />
        <NumberInput label="Machines (1–30)" value={machines} setValue={setMachines} min={1} max={30} />
        <button
          onClick={handleResize}
          disabled={resizeLoading}
          className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
        >
          {resizeLoading ? '…' : 'Apply'}
        </button>
        <StatusMsg result={resizeResult} />
      </div>

      <hr className="border-gray-800" />

      {/* Anomaly injection */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
          Anomaly Injection
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Category</label>
            <select
              value={anomalyCategory}
              onChange={(e) => setAnomalyCategory(e.target.value)}
              className="bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-cyan-500"
            >
              <option value="vehicle">Vehicle</option>
              <option value="building">Building</option>
              <option value="machine">Machine</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Device ID</label>
            <input
              type="text"
              placeholder="e.g. vehicle-07"
              value={anomalyDeviceId}
              onChange={(e) => setAnomalyDeviceId(e.target.value)}
              className="bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-white text-sm w-36 focus:outline-none focus:border-cyan-500 placeholder-gray-600"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Anomaly Type</label>
            <select
              value={anomalyType}
              onChange={(e) => setAnomalyType(e.target.value)}
              className="bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-cyan-500"
            >
              <option value="engine_temp_spike">Engine Temp Spike</option>
              <option value="hvac_failure">HVAC Failure</option>
              <option value="high_vibration">High Vibration</option>
              <option value="battery_low">Battery Low</option>
              <option value="generic">Generic</option>
            </select>
          </div>
          <button
            onClick={handleInjectAnomaly}
            disabled={anomalyLoading || !anomalyDeviceId.trim()}
            className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
          >
            {anomalyLoading ? '…' : 'Inject Anomaly'}
          </button>
          <StatusMsg result={anomalyResult} />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleClearAnomalies}
          disabled={clearLoading}
          className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
        >
          {clearLoading ? '…' : '🗑 Clear All Anomalies'}
        </button>
        <StatusMsg result={clearResult} />
      </div>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Section 5: Traffic Bot
// ---------------------------------------------------------------------------
function TrafficCard() {
  const qc = useQueryClient();
  const { data: trafficStatus, isLoading } = useQuery({
    queryKey: ['traffic-status'],
    queryFn: getTrafficStatus,
    refetchInterval: 10_000,
  });

  const [startResult, setStartResult] = useState(null);
  const [stopResult, setStopResult] = useState(null);
  const [burstResult, setBurstResult] = useState(null);
  const [loading, setLoading] = useState(null); // 'start' | 'stop' | 'burst'
  const [countdown, setCountdown] = useState(null);

  useEffect(() => {
    if (countdown === null || countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  async function handleStart() {
    setLoading('start');
    setStartResult(null);
    try {
      await startTraffic();
      setStartResult({ ok: true });
      qc.invalidateQueries({ queryKey: ['traffic-status'] });
    } catch (err) {
      setStartResult({ ok: false, error: err.response?.data?.message ?? err.message });
    } finally {
      setLoading(null);
    }
  }

  async function handleStop() {
    setLoading('stop');
    setStopResult(null);
    try {
      await stopTraffic();
      setStopResult({ ok: true });
      qc.invalidateQueries({ queryKey: ['traffic-status'] });
    } catch (err) {
      setStopResult({ ok: false, error: err.response?.data?.message ?? err.message });
    } finally {
      setLoading(null);
    }
  }

  async function handleBurst() {
    setLoading('burst');
    setBurstResult(null);
    try {
      await burstTraffic(2);
      setBurstResult({ ok: true });
      setCountdown(120);
      qc.invalidateQueries({ queryKey: ['traffic-status'] });
    } catch (err) {
      setBurstResult({ ok: false, error: err.response?.data?.message ?? err.message });
    } finally {
      setLoading(null);
    }
  }

  const isRunning = trafficStatus?.running ?? trafficStatus?.status === 'running';

  return (
    <SectionCard title="Traffic Bot">
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">Status:</span>
        {isLoading ? (
          <span className="text-gray-500 text-xs">…</span>
        ) : (
          <span
            className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
              isRunning
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'bg-gray-700 text-gray-400 border border-gray-600'
            }`}
          >
            {isRunning ? '● Running' : '○ Stopped'}
          </span>
        )}
        {trafficStatus?.rpm_current != null && (
          <span className="text-xs text-gray-500 ml-2">{trafficStatus.rpm_current} req/min</span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handleStart}
          disabled={loading !== null}
          className="px-4 py-2 rounded-lg bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
        >
          {loading === 'start' ? '…' : '▶ Start Traffic'}
        </button>
        <StatusMsg result={startResult} />

        <button
          onClick={handleStop}
          disabled={loading !== null}
          className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
        >
          {loading === 'stop' ? '…' : '⏹ Stop Traffic'}
        </button>
        <StatusMsg result={stopResult} />

        <button
          onClick={handleBurst}
          disabled={loading !== null}
          className="px-4 py-2 rounded-lg bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
        >
          {loading === 'burst' ? '…' : '⚡ Burst (2 min)'}
        </button>
        {countdown !== null && countdown > 0 && (
          <span className="text-yellow-400 text-xs font-mono">
            Burst: {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, '0')} remaining
          </span>
        )}
        <StatusMsg result={burstResult} />
      </div>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Live activity counters
// ---------------------------------------------------------------------------
function LiveCounters() {
  const { data: traffic } = useQuery({
    queryKey: ['traffic-status'],
    queryFn: getTrafficStatus,
    refetchInterval: 5_000,
    retry: false,
  });
  const { data: incData } = useQuery({
    queryKey: ['incidents', 'open'],
    queryFn: () => getIncidents({ status: 'open', limit: 100 }),
    refetchInterval: 10_000,
    retry: false,
  });

  const incidents = Array.isArray(incData) ? incData : incData?.incidents ?? [];
  const running = traffic?.running ?? traffic?.status === 'running';
  const rpm = traffic?.rpm_current ?? traffic?.rate_rpm ?? traffic?.rpm ?? 0;
  const completed = traffic?.journeys_completed ?? null;
  // traffic-bot getStatus() returns `journeys` as an array of { name, weight, enabled }.
  const journeys = Array.isArray(traffic?.journeys) ? traffic.journeys : [];

  const tiles = [
    { label: 'Traffic', value: running ? 'Running' : 'Stopped', cls: running ? 'text-green-400' : 'text-gray-400' },
    { label: 'Requests / min', value: Math.round(rpm), cls: 'text-cyan-400' },
    { label: 'Journeys run', value: completed != null ? Number(completed).toLocaleString() : '—', cls: 'text-cyan-400' },
    { label: 'Open incidents', value: incidents.length, cls: incidents.length > 0 ? 'text-rose-400' : 'text-gray-300' },
  ];

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 px-5 py-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Live activity</p>
        <span className="flex items-center gap-1.5 text-xs text-green-400">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />Live
        </span>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {tiles.map((t) => (
          <div key={t.label} className="bg-gray-800 rounded-lg p-3">
            <p className="text-xs text-gray-500">{t.label}</p>
            <p className={`text-2xl font-bold mt-0.5 ${t.cls}`}>{t.value}</p>
          </div>
        ))}
      </div>
      {journeys.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3 text-xs">
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
      <p className="text-xs text-gray-600 mt-3">
        Sessions, spans &amp; business events are visible in Dynatrace (RUM, Distributed traces, Business Analytics).
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline demo guide
// ---------------------------------------------------------------------------
function DemoGuideCard() {
  return (
    <SectionCard title="Demo Guide" defaultOpen={false}>
      <div className="space-y-3">
        {DEMO_GUIDE.map((g) => (
          <div key={g.id} className="rounded-lg bg-gray-800 border border-gray-700 p-4">
            <p className="text-sm font-semibold text-white">{g.id}. {g.title}</p>
            <p className="text-xs text-gray-400 mt-0.5">{g.shows}</p>
            <ol className="list-decimal list-inside mt-2 space-y-1 text-xs text-gray-400">
              {g.steps.map((s, i) => <li key={i}>{s}</li>)}
            </ol>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Main DemoControl page
// ---------------------------------------------------------------------------
export default function DemoControl() {
  const qc = useQueryClient();

  const { data: demoStatus, isLoading: statusLoading } = useQuery({
    queryKey: ['demo-status'],
    queryFn: getDemoStatus,
    refetchInterval: 10_000,
  });

  async function handleResetAll() {
    await resetAll();
    qc.invalidateQueries({ queryKey: ['demo-status'] });
    qc.invalidateQueries({ queryKey: ['fault-status'] });
    qc.invalidateQueries({ queryKey: ['fleet-status'] });
    qc.invalidateQueries({ queryKey: ['traffic-status'] });
  }

  const activeScenarioId = demoStatus?.active_scenario?.id;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Demo Control</h1>
        <span className="text-xs text-gray-600">SE/DXC Use Only</span>
      </div>

      {/* System Status bar */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 px-5 py-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          System Status
        </p>
        {statusLoading ? (
          <p className="text-gray-500 text-sm">Loading…</p>
        ) : (
          <SystemStatus status={demoStatus} onResetAll={handleResetAll} />
        )}
      </div>

      <LiveCounters />
      <DemoGuideCard />
      <ScenariosCard activeScenarioId={activeScenarioId} />
      <FaultCard />
      <FleetCard />
      <TrafficCard />
    </div>
  );
}

import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getDemoStatus,
  getScenarios,
  startScenario,
  resetActiveScenario,
  resetAll,
  getFleetStatus,
  resizeFleetType,
  getTrafficStatus,
  startTraffic,
  stopTraffic,
  burstTraffic,
  setJourneyEnabled,
  purgeMessages,
} from '../api/demo.js';
import { getIncidents } from '../api/incidents.js';
import { getFaultGates, setFaultGate, clearFaultGate } from '../api/devices.js';
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

// ---------------------------------------------------------------------------
// Section 1: System Status
// ---------------------------------------------------------------------------
function SystemStatus({ status, onResetAll }) {
  const [confirm, setConfirm] = useState(false);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [purgeLoading, setPurgeLoading] = useState(false);
  const [purgeResult, setPurgeResult] = useState(null);

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

  async function handlePurgeMessages() {
    setPurgeLoading(true);
    setPurgeResult(null);
    try {
      await purgeMessages();
      setPurgeResult({ ok: true });
    } catch (err) {
      setPurgeResult({ ok: false, error: err.response?.data?.message ?? err.message });
    } finally {
      setPurgeLoading(false);
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
          onClick={handlePurgeMessages}
          disabled={purgeLoading}
          title="Delete all citizen inbox messages from the database"
          className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
        >
          {purgeLoading ? '…' : '🗑 Purge Messages'}
        </button>
        <StatusMsg result={purgeResult} />
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
// Section 2: Scenario Control
// Named fault scenarios + their tunable options, all in one place. Replaces the
// former duplicate "Demo Scenarios" + "Failure Injection" sections: each row is
// a scenario (description, auto-reset, Activate/Stop) with inline sliders for
// whatever it exposes (DB/LLM latency seconds, memory-leak cap).
// ---------------------------------------------------------------------------

// Pick only the known param keys out of an active-scenario params payload.
function filterParams(params, active) {
  const out = {};
  for (const p of params) if (active[p.name] != null) out[p.name] = active[p.name];
  return out;
}

function ScenarioRow({ sc, isActive, blocked, loading, result, activeParams, onStart, onStop }) {
  const params = Array.isArray(sc.params) ? sc.params : [];
  const clearCfg = sc.clear || { mode: 'manual', minutes: 5, min: 1, max: 30 };

  // Local control values; seeded from the active run's applied values (when this
  // scenario is active) or the scenario / param defaults.
  const [values, setValues] = useState(() =>
    Object.fromEntries(
      params.map((p) => [
        p.name,
        activeParams && activeParams[p.name] != null ? activeParams[p.name] : p.default,
      ])
    )
  );
  const [clearMode, setClearMode] = useState(activeParams?.clear_mode ?? clearCfg.mode);
  const [clearMinutes, setClearMinutes] = useState(activeParams?.clear_minutes ?? clearCfg.minutes);

  // Re-sync controls to the applied values whenever the active params change.
  useEffect(() => {
    if (!activeParams) return;
    setValues((v) => ({ ...v, ...filterParams(params, activeParams) }));
    if (activeParams.clear_mode) setClearMode(activeParams.clear_mode);
    if (activeParams.clear_minutes != null) setClearMinutes(activeParams.clear_minutes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(activeParams)]);

  const disabled = isActive || blocked;

  function stepMinutes(delta) {
    setClearMinutes((m) => Math.min(clearCfg.max ?? 30, Math.max(clearCfg.min ?? 1, m + delta)));
  }

  return (
    <div
      className={`rounded-lg p-4 border transition-colors ${
        isActive ? 'bg-orange-500/10 border-orange-500/30' : 'bg-gray-800 border-gray-700'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-white">{sc.name}</p>
            {isActive && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30">
                Active
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-1">{sc.description}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isActive ? (
            <button
              onClick={() => onStop(sc.id)}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
            >
              {loading ? '…' : '■ Stop'}
            </button>
          ) : (
            <button
              onClick={() =>
                onStart(sc.id, { ...values, clear_mode: clearMode, clear_minutes: clearMinutes })
              }
              disabled={loading || blocked}
              title={blocked ? 'Stop the active scenario first' : undefined}
              className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
            >
              {loading ? '…' : '▶ Activate'}
            </button>
          )}
          <StatusMsg result={result} />
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-gray-800 space-y-2.5">
        {params.map((p) => (
          <div key={p.name} className="flex items-center gap-2">
            <label className="text-xs text-gray-500 w-20">{p.label}</label>
            <input
              type="range"
              min={p.min}
              max={p.max}
              step={p.step ?? 1}
              value={values[p.name] ?? p.default}
              disabled={disabled}
              onChange={(e) => setValues((v) => ({ ...v, [p.name]: Number(e.target.value) }))}
              className="w-36 accent-cyan-400 disabled:opacity-50"
            />
            <span className="text-xs text-gray-400 tabular-nums">
              {values[p.name] ?? p.default}{p.unit}
            </span>
          </div>
        ))}

        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-xs text-gray-500 w-20">Clear</label>
          <div className="inline-flex rounded-md overflow-hidden border border-gray-700">
            {['manual', 'auto'].map((m) => (
              <button
                key={m}
                onClick={() => setClearMode(m)}
                disabled={disabled}
                className={`px-2.5 py-1 text-xs capitalize transition-colors disabled:opacity-50 ${
                  clearMode === m
                    ? 'bg-cyan-600 text-white'
                    : 'bg-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          {clearMode === 'auto' && (
            <div className="inline-flex items-center gap-1.5">
              <button
                onClick={() => stepMinutes(-1)}
                disabled={disabled || clearMinutes <= (clearCfg.min ?? 1)}
                className="w-6 h-6 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-gray-300 text-sm leading-none"
                aria-label="Decrease auto-clear minutes"
              >
                −
              </button>
              <span className="text-xs text-gray-300 tabular-nums w-12 text-center">
                {clearMinutes} min
              </span>
              <button
                onClick={() => stepMinutes(1)}
                disabled={disabled || clearMinutes >= (clearCfg.max ?? 30)}
                className="w-6 h-6 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-gray-300 text-sm leading-none"
                aria-label="Increase auto-clear minutes"
              >
                +
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ScenarioControlCard({ activeScenario }) {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['scenarios'],
    queryFn: getScenarios,
    staleTime: 120_000,
  });

  const scenarios = data?.scenarios ?? [];
  const activeId = activeScenario?.id ?? null;
  const [loadingId, setLoadingId] = useState(null);
  const [results, setResults] = useState({});

  async function run(id, fn) {
    setLoadingId(id);
    setResults((r) => ({ ...r, [id]: null }));
    try {
      await fn();
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
    <SectionCard title="Scenario Control">
      <p className="text-xs text-gray-500 -mt-1">
        One-click fault scenarios. Only one runs at a time — stop it (or use Reset All) before
        starting another. Adjust a scenario's options before activating.
      </p>
      {isLoading && <p className="text-gray-500 text-sm">Loading scenarios…</p>}
      {error && <p className="text-rose-400 text-sm">Failed to load scenarios</p>}
      <div className="space-y-3">
        {scenarios.map((sc) => (
          <ScenarioRow
            key={sc.id}
            sc={sc}
            isActive={activeId === sc.id}
            blocked={activeId !== null && activeId !== sc.id}
            loading={loadingId === sc.id}
            result={results[sc.id]}
            activeParams={activeId === sc.id ? activeScenario?.params ?? null : null}
            onStart={(id, params) => run(id, () => startScenario(id, params))}
            onStop={(id) => run(id, () => resetActiveScenario())}
          />
        ))}
        {!isLoading && scenarios.length === 0 && (
          <p className="text-gray-500 text-sm">No scenarios available</p>
        )}
      </div>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Section 4: Fleet Management — fully generic over whatever device types the
// industry config declares (industry.iot.deviceTypes), not a fixed vehicle/
// building/machine set. Resize is per-type (iot-simulator only exposes
// additive add + single remove, so the backend computes the delta). Fault
// injection targets a whole device type's fault gate (iot-simulator's
// ongoing, probabilistic {enabled, rate, magnitude} model) rather than a
// one-shot single-device anomaly, which no longer has a backend endpoint.
// ---------------------------------------------------------------------------
function DeviceTypeRow({ deviceType, gate, onResize, onSetGate, onClearGate, resizing, gateLoading }) {
  const [count, setCount] = useState(deviceType.currentCount);
  const [rate, setRate] = useState(gate?.enabled ? Math.round(gate.rate * 100) : 30);
  const [magnitude, setMagnitude] = useState(gate?.magnitude?.value ?? 50);

  useEffect(() => {
    setCount(deviceType.currentCount);
  }, [deviceType.currentCount]);

  const enabled = Boolean(gate?.enabled);

  return (
    <div className="rounded-lg bg-gray-800 border border-gray-700 p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm font-semibold text-white">
          {deviceType.displayName}
          {enabled && (
            <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">
              Fault active
            </span>
          )}
        </p>
        <span className="text-xs text-gray-500">{deviceType.currentCount} active</span>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">Count</label>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={0}
              max={500}
              value={count}
              onChange={(e) => setCount(Math.max(0, Number(e.target.value)))}
              className="w-20 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-sm text-center focus:outline-none focus:border-cyan-500"
            />
            <button
              onClick={() => onResize(deviceType.type, count)}
              disabled={resizing}
              className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
            >
              {resizing ? '…' : 'Apply'}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500 w-10">Rate</label>
          <input
            type="range"
            min={5}
            max={100}
            step={5}
            value={rate}
            disabled={enabled}
            onChange={(e) => setRate(Number(e.target.value))}
            className="w-28 accent-rose-400 disabled:opacity-50"
          />
          <span className="text-xs text-gray-400 tabular-nums w-10">{rate}%</span>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500 w-16">Deviation</label>
          <input
            type="range"
            min={-100}
            max={200}
            step={10}
            value={magnitude}
            disabled={enabled}
            onChange={(e) => setMagnitude(Number(e.target.value))}
            className="w-28 accent-rose-400 disabled:opacity-50"
          />
          <span className="text-xs text-gray-400 tabular-nums w-10">{magnitude > 0 ? '+' : ''}{magnitude}%</span>
        </div>

        {enabled ? (
          <button
            onClick={() => onClearGate(deviceType.type)}
            disabled={gateLoading}
            className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
          >
            {gateLoading ? '…' : '■ Stop Fault'}
          </button>
        ) : (
          <button
            onClick={() => onSetGate(deviceType.type, {
              enabled: true,
              rate: rate / 100,
              magnitude: { type: 'percent', value: magnitude },
            })}
            disabled={gateLoading}
            className="px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
          >
            {gateLoading ? '…' : '▶ Inject Fault'}
          </button>
        )}
      </div>
    </div>
  );
}

function FleetCard() {
  const qc = useQueryClient();
  const { data: fleetStatus, isLoading } = useQuery({
    queryKey: ['fleet-status'],
    queryFn: getFleetStatus,
    refetchInterval: 10_000,
  });
  const { data: faultGatesData } = useQuery({
    queryKey: ['iot-fault-gates'],
    queryFn: getFaultGates,
    refetchInterval: 10_000,
  });

  const deviceTypes = Array.isArray(fleetStatus?.deviceTypes) ? fleetStatus.deviceTypes : [];
  const gates = faultGatesData?.gates ?? {};

  const [resizingType, setResizingType] = useState(null);
  const [gateLoadingType, setGateLoadingType] = useState(null);
  const [results, setResults] = useState({});

  async function handleResize(type, count) {
    setResizingType(type);
    setResults((r) => ({ ...r, [type]: null }));
    try {
      await resizeFleetType(type, count);
      setResults((r) => ({ ...r, [type]: { ok: true } }));
      qc.invalidateQueries({ queryKey: ['fleet-status'] });
    } catch (err) {
      setResults((r) => ({ ...r, [type]: { ok: false, error: err.response?.data?.message ?? err.message } }));
    } finally {
      setResizingType(null);
    }
  }

  async function handleSetGate(type, body) {
    setGateLoadingType(type);
    try {
      await setFaultGate(type, body);
      qc.invalidateQueries({ queryKey: ['iot-fault-gates'] });
    } catch (err) {
      setResults((r) => ({ ...r, [type]: { ok: false, error: err.response?.data?.message ?? err.message } }));
    } finally {
      setGateLoadingType(null);
    }
  }

  async function handleClearGate(type) {
    setGateLoadingType(type);
    try {
      await clearFaultGate(type);
      qc.invalidateQueries({ queryKey: ['iot-fault-gates'] });
    } catch (err) {
      setResults((r) => ({ ...r, [type]: { ok: false, error: err.response?.data?.message ?? err.message } }));
    } finally {
      setGateLoadingType(null);
    }
  }

  return (
    <SectionCard title="IoT Fleet Management">
      <p className="text-xs text-gray-500 -mt-1">
        Resize any device type's population, or inject an ongoing probabilistic fault into a
        type's metrics (pushes values outside their normal range so Dynatrace anomaly
        detection has something real to react to).
      </p>
      {isLoading && <p className="text-gray-500 text-sm">Loading fleet status…</p>}
      {!isLoading && deviceTypes.length === 0 && (
        <p className="text-gray-500 text-sm">No device types configured for this industry.</p>
      )}
      <div className="space-y-3">
        {deviceTypes.map((dt) => (
          <div key={dt.type}>
            <DeviceTypeRow
              deviceType={dt}
              gate={gates[dt.type]}
              onResize={handleResize}
              onSetGate={handleSetGate}
              onClearGate={handleClearGate}
              resizing={resizingType === dt.type}
              gateLoading={gateLoadingType === dt.type}
            />
            <div className="mt-1"><StatusMsg result={results[dt.type]} /></div>
          </div>
        ))}
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

  // Chat-traffic toggle — drives the 'chatbot' journey so the LLM-latency scenario
  // has a steady `meridian.chat` baseline. Effective state comes from traffic-bot.
  const journeys = Array.isArray(trafficStatus?.journeys) ? trafficStatus.journeys : [];
  const chatJourney = journeys.find((j) => j.name === 'chatbot');
  const [chatEnabled, setChatEnabled] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatResult, setChatResult] = useState(null);

  useEffect(() => {
    if (chatJourney) setChatEnabled(Boolean(chatJourney.enabled));
  }, [chatJourney?.enabled]);

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

  async function handleChatToggle(val) {
    setChatEnabled(val); // optimistic
    setChatLoading(true);
    setChatResult(null);
    try {
      await setJourneyEnabled('chatbot', val);
      setChatResult({ ok: true });
      qc.invalidateQueries({ queryKey: ['traffic-status'] });
    } catch (err) {
      setChatEnabled(!val); // revert on failure
      setChatResult({ ok: false, error: err.response?.data?.message ?? err.message });
    } finally {
      setChatLoading(false);
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

      <div className="flex items-center gap-3 pt-3 border-t border-gray-800">
        <Toggle
          checked={chatEnabled}
          onChange={handleChatToggle}
          label="Chat traffic (feeds the LLM-Latency scenario)"
        />
        {chatLoading && <span className="text-gray-500 text-xs">…</span>}
        <StatusMsg result={chatResult} />
        <span className="text-xs text-gray-600 ml-auto">
          Generates a steady <code className="text-gray-500">meridian.chat</code> baseline; real LLM calls.
        </span>
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
// External trigger API — lets an external demo-automation system call the same
// scenario endpoints this panel uses, authenticated with a per-instance API key
// instead of an operator login. See api-gateway's x-demo-api-key header.
// ---------------------------------------------------------------------------
function ExternalTriggerCard() {
  return (
    <SectionCard title="External Trigger API" defaultOpen={false}>
      <p className="text-xs text-gray-400">
        Any scenario below can also be triggered by an external system — useful for wiring
        this demo up to something that fires events automatically. Call the gateway with an{' '}
        <code className="text-gray-300 font-mono">x-demo-api-key</code> header instead of
        logging in as the operator. The key for this instance is in its Helm secret — printed
        by <code className="text-gray-300 font-mono">deploy.sh</code> when{' '}
        <code className="text-gray-300 font-mono">auth.demoApiKey</code> is set, or readable via{' '}
        <code className="text-gray-300 font-mono">kubectl get secret &lt;release&gt;-secrets</code>.
      </p>
      <div className="mt-3 space-y-1.5 font-mono text-xs text-gray-400">
        <p>POST /api/v1/demo-control/scenarios/:id/start</p>
        <p>DELETE /api/v1/demo-control/scenarios/active</p>
        <p>POST /api/v1/demo-control/scenarios/reset-all</p>
        <p>GET /api/v1/demo-control/scenarios — list available scenario ids</p>
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
      <ScenarioControlCard activeScenario={demoStatus?.active_scenario} />
      <FleetCard />
      <TrafficCard />
      <ExternalTriggerCard />
    </div>
  );
}

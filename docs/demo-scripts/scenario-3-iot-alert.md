# Demo Scenario 3: IoT Telemetry Stream + Alert

**Duration**: ~6 minutes  
**Dynatrace features**: OpenTelemetry metrics ingestion, distributed traces, Davis AI correlation  
**Narrative**: "A smart building's HVAC is overheating. Dynatrace sees it in real time from the IoT device."

---

## Setup

- Ops Dashboard open: http://localhost:8081 — **IoT** tab visible
- Dynatrace open on **Metrics** (search `iot.building.hvac_temp`)
- Second Dynatrace tab on **Problems**

---

## Script

### 1. Show the live IoT feed (1 min)

In the Ops Dashboard → IoT Feed:
> "This is our smart city's IoT telemetry feed. We have 30 connected vehicles reporting GPS and engine data, 15 smart buildings reporting HVAC, energy, and occupancy, and 10 industrial machines on the maintenance network."

Point out the live updates coming in. Highlight that all buildings show green / normal.

In Dynatrace → Metrics, show `iot.building.hvac_temp`:
> "And here's that same data in Dynatrace — HVAC temperatures for all 15 buildings, ingested via OpenTelemetry. These are real-time metrics from the IoT devices, arriving through our OpenTelemetry Collector."

### 2. Trigger the anomaly (30 sec)

In Demo Control Panel → **Anomaly Injection**:
1. Category = **Building**
2. Device ID = **`bldg-007`** (valid building ids are `bldg-000`–`bldg-014`)
3. Anomaly Type = **HVAC Failure**
4. Click **Inject Anomaly**

> "I've just told the IoT simulator to start emitting out-of-range HVAC readings
> from building `bldg-007`. This simulates a failing cooling system — a
> compressor fault or a refrigerant leak."

### 3. Watch the data arrive (~3 min)

In Dynatrace Metrics: `iot.building.hvac_temp` for device `bldg-007` spikes to
~95°C, above the normal range.

> Timing: the HVAC detector requires **3 consecutive 1-minute windows** over
> threshold before it raises an incident, so the metric spikes immediately but
> the incident (next step) appears after ~3 minutes. (Vehicle and machine
> anomalies fire in ~1 minute.)

> "Watch the metric in Dynatrace. The anomalous readings are arriving through our OTel Collector — these have device-level resource attributes, so Dynatrace knows which specific building and sensor is reporting the problem."

### 4. Show the incident creation (1 min)

In the Ops Dashboard → Incidents tab: a new incident referencing `bldg-007`
appears (the title is auto-generated from the anomaly, e.g. "IoT anomaly detected:
hvac_overtemp on bldg-007", with severity set by the detector).

In Dynatrace Distributed Traces: find the ingest trace from `iot-ingestion`:
> "Here's the ingest trace — the device emitted a reading, our Go ingestion
> service received it and published to Kafka. The telemetry processor (Python)
> then aggregates readings into 1-minute windows and, on threshold breach,
> publishes to `iot.anomalies`, which city-operations (Java) consumes to create
> the incident. So it's an OTel ingest path feeding a Kafka-driven, asynchronous
> detection-and-incident step — Go, Kafka, Python, and Java end to end."

### 5. Davis AI correlation (1 min)

If Davis AI has raised a problem (may take 2-3 min):
> "And here's where it gets really powerful. Davis AI has correlated this OTel metric anomaly with the downstream impact on city-operations. It's not treating these as separate events — it's presenting them as a single problem with a clear cause: the IoT sensor data."

### 6. Resolve and reset (30 sec)

In Demo Control Panel → Anomaly Injection: **Clear All Anomalies**

> "The IoT device returns to normal readings, the alert clears, and the incident is automatically updated."

---

## Key talking points

- OpenTelemetry is a first-class citizen in Dynatrace — not an afterthought
- OTel semantic conventions (device attributes like `device.id`, `device.category`) are preserved and queryable
- The full chain from IoT device → Kafka → service → incident is traced end-to-end
- Davis AI correlates OTel metrics with APM data — unified observability
- Real IoT scenarios: building management, fleet monitoring, industrial automation

# Demo Scenario 3: IoT Telemetry Stream + Alert

**Duration**: ~6 minutes  
**Dynatrace features**: OpenTelemetry metrics ingestion, distributed traces, Davis AI correlation  
**Narrative**: "Building 7's HVAC is overheating. Dynatrace sees it in real time from the IoT device."

---

## Setup

- Ops Dashboard open: http://localhost:8081 — IoT Feed tab visible
- Dynatrace open on **Metrics** (search `iot.device.building.hvac_temp`)
- Second Dynatrace tab on **Problems**

---

## Script

### 1. Show the live IoT feed (1 min)

In the Ops Dashboard → IoT Feed:
> "This is our smart city's IoT telemetry feed. We have 30 connected vehicles reporting GPS and engine data, 15 smart buildings reporting HVAC, energy, and occupancy, and 10 industrial machines on the maintenance network."

Point out the live updates coming in. Highlight that all buildings show green / normal.

In Dynatrace → Metrics, show `iot.device.building.hvac_temp`:
> "And here's that same data in Dynatrace — HVAC temperatures for all 15 buildings, ingested via OpenTelemetry. These are real-time metrics from the IoT devices, arriving through our OpenTelemetry Collector."

### 2. Trigger the anomaly (30 sec)

In Demo Control Panel → IoT Anomaly Injection:
1. Find **"Building HVAC Failure"**
2. Select **Building 07** from the dropdown
3. Click **"Trigger Anomaly"**

> "I've just told the IoT simulator to start emitting out-of-range HVAC readings from Building 7. This simulates what would happen if that building's cooling system started failing — maybe a compressor fault, a refrigerant leak."

### 3. Watch the data arrive (1 min)

In the Ops Dashboard IoT Feed: Building 07 flips to orange/red status.

In Dynatrace Metrics: `iot.device.building.hvac_temp` for device `bldg-07` shows a spike above the normal range.

> "Watch the metric in Dynatrace. The anomalous readings are arriving through our OTel Collector — these have device-level resource attributes, so Dynatrace knows which specific building and sensor is reporting the problem."

### 4. Show the incident creation (1 min)

In the Ops Dashboard → Incidents tab: A new incident has appeared: "HVAC Temperature Alert — Building 07".

In Dynatrace Distributed Traces: Find the trace from `iot-ingestion`:
> "Here's the trace. The IoT device emitted a reading, our Go ingestion service picked it up, published to Kafka, the telemetry processor consumed it, detected the anomaly threshold breach, and created this incident in city-operations. All in one distributed trace — spanning two Go services, a Kafka topic, and a Python service."

### 5. Davis AI correlation (1 min)

If Davis AI has raised a problem (may take 2-3 min):
> "And here's where it gets really powerful. Davis AI has correlated this OTel metric anomaly with the downstream impact on city-operations. It's not treating these as separate events — it's presenting them as a single problem with a clear cause: the IoT sensor data."

### 6. Resolve and reset (30 sec)

In Demo Control Panel: **"Resolve Anomaly — Building 07"**

> "The IoT device returns to normal readings, the alert clears, and the incident is automatically updated."

---

## Key talking points

- OpenTelemetry is a first-class citizen in Dynatrace — not an afterthought
- OTel semantic conventions (resource attributes like `device.id`, `device.type`) are preserved and queryable
- The full chain from IoT device → Kafka → service → incident is traced end-to-end
- Davis AI correlates OTel metrics with APM data — unified observability
- Real IoT scenarios: building management, fleet monitoring, industrial automation

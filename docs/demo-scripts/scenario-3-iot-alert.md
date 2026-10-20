# Demo Scenario 3: IoT Telemetry Stream + Alert

**Duration**: ~5 minutes
**Dynatrace features**: OpenTelemetry metrics/logs ingestion, Davis AI anomaly detection
**Narrative**: "A city vehicle's brake system is degrading. Dynatrace sees it in real time from the IoT device, with no custom detection code on our side."

---

## Setup

- Dynatrace open on **Metrics** (search `iot.vehicle.engine_temp`)
- Second Dynatrace tab on **Problems**
- (Optional) a terminal or API client ready to call demo-control-api

---

## Script

### 1. Show the live IoT feed (1 min)

In Dynatrace → Metrics, show `iot.vehicle.engine_temp`:
> "This is Meridian's fake IoT device fleet — iot-simulator. By default City
> runs 30 connected vehicles reporting speed/engine temp/fuel level, 15 smart
> buildings reporting HVAC/CO2/energy, and 10 industrial machines reporting
> vibration/error rate — each a separate goroutine ticking on its own
> schedule, with real parent/child hierarchy where it makes sense (every
> vehicle in this build also reports 4 tire sensors). None of this is
> hardcoded to City, either — any industry config can declare its own device
> types, metrics, ranges, and hierarchy."

Point out the normal, steady readings arriving straight through the
OpenTelemetry Collector — no intermediate ingestion service, no Kafka hop.

### 2. Trigger an ongoing problem (30 sec)

Call demo-control-api to enable a fault gate on the vehicle fleet:

```bash
curl -X PUT http://<gateway>/api/v1/demo-control/iot/fault-gates/vehicle \
  -H 'Content-Type: application/json' \
  -d '{"enabled": true, "rate": 1.0, "metric": "iot.vehicle.engine_temp", "magnitude": {"type": "percent", "value": 35}}'
```

> "I've just told the simulator to push every vehicle's engine temperature 35%
> above its normal reading, every tick, until I turn it back off. This is a
> fault *gate* — not a one-shot blip — so it keeps producing an anomalous
> signal for as long as it's enabled, the way a real degrading sensor would."

### 3. Watch the data arrive (~2 min)

In Dynatrace Metrics: `iot.vehicle.engine_temp` climbs well outside its normal
band for every vehicle device.

> "Watch the metric in Dynatrace. There's no custom threshold code on our
> side deciding this is abnormal — these are just real metrics, with
> device-level resource attributes (`device.id`, `device.type`,
> `device.parent_id` for hierarchy), flowing straight to Dynatrace. Davis AI
> does the anomaly detection."

### 4. Davis AI anomaly detection (1-2 min)

If Davis AI has raised a problem:
> "Here's Davis AI picking up the anomaly directly from the OTel metric
> stream — no custom pipeline, no bespoke incident-creation code. This is
> exactly what we want to show: Dynatrace handling real metric ingestion and
> anomaly detection for IoT-style device data out of the box."

### 5. Resolve and reset (30 sec)

```bash
curl -X DELETE http://<gateway>/api/v1/demo-control/iot/fault-gates/vehicle
```

> "The fleet returns to normal readings and the problem closes on its own."

---

## Key talking points

- OpenTelemetry is a first-class citizen in Dynatrace — not an afterthought
- OTel semantic conventions (device attributes, parent/child hierarchy) are preserved and queryable
- Device types, metrics, ranges, and hierarchy are entirely config-driven — a new industry (trains, robots, transit, mining equipment, building sensors) needs zero new code
- Fault gates demonstrate *ongoing* problem injection, not just one-shot blips
- Davis AI detects the anomaly directly from real telemetry — Dynatrace does the detection work, not custom application code

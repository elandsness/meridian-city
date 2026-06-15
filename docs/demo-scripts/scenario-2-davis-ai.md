# Demo Scenario 2: Davis AI Root Cause Analysis

**Duration**: ~8 minutes  
**Dynatrace features**: Davis AI, Problem detection, anomaly comparison, root cause analysis  
**Narrative**: "We just injected a problem into production. Watch Dynatrace find the root cause before any human would."

---

## Setup

- Ops Dashboard open: http://localhost:8081 (login: demo / dynatrace) — Demo Control Panel tab
- Dynatrace open on **Problems** (or **Davis AI**)
- Traffic bot must be running (default) to generate background load

**Important**: Davis AI needs ~24 hours of baseline traffic to have enough data for anomaly detection. For first-time demos on a fresh install, use the "slow trace comparison" in Scenario 1 instead, or allow the platform to run overnight before using this scenario.

---

## Script

### 1. Show the healthy baseline (1 min)

In Dynatrace Services → citizen-service:
> "Here's citizen-service in its normal state. Response time is stable, error rate is near zero. Davis AI is constantly learning this baseline — what's normal for this service, at this time of day, under this load."

Point out the response time graph and the green health indicator.

### 2. Inject the failure (30 sec)

In the Ops Dashboard → Demo Control Panel:
1. Under **Failure Injection**, toggle on **"Citizen Service — DB Slowdown"** (set
   the seconds slider, e.g. 3s) — or click **▶ Activate** on the **"Database
   Slowdown"** scenario (2s, auto-resets after 5 min)
2. The toggle switches on; citizen-service now delays its service-request DB write

> "I just injected an artificial delay before citizen-service's service-request
> database write. This simulates a struggling database — a slow query, lock
> contention, a connection-pool problem — on the request-submission path. The
> traffic bot is submitting requests continuously, so it'll start hitting this."

### 3. Watch Davis AI detect it (2-3 min wait)

> "Let's watch Dynatrace. I haven't touched any alert thresholds. Davis AI is watching the live traffic and will tell us when something looks wrong."

During the wait, open the Services view and watch the response time graph climb. Point out the visual baseline deviation.

After 1-2 minutes, a **Problem** card appears.

### 4. Open the Problem card (2 min)

Click on the Problem:
> "There it is. Davis AI has detected a degradation. Let's see what it found."

Point out:
- **Impact scope**: Which services are affected (citizen-service, and downstream via service-dispatch if cascading)
- **Root cause hypothesis**: Davis points to the SQL query response time as the primary anomaly
- **Evidence trail**: The anomaly timeline shows exactly when the slowdown started
- **Suggested actions** (if shown)

> "Davis didn't just say 'something is slow'. It traced the anomaly to the SQL layer and told us which service, which operation, and when it started. That's the difference between an alert and an answer."

### 5. Compare traces (1 min)

In Problems → Root Cause → View traces:
- Compare a trace from before the injection with one from during
- Point out: the citizen-service DB write span now shows the injected delay (2–3s) instead of a few ms

### 6. Reset and show recovery (1 min)

In Demo Control Panel → **"Reset All"** (or just wait — the Database Slowdown scenario auto-resets after 5 minutes):

> "Let's clear the failure."

Watch the response time graph return to baseline. The Problem card shows as Resolved.

> "Davis AI automatically resolves the problem when the anomaly disappears. No manual intervention, no on-call page to close. It's completely autonomous."

---

## Key talking points

- Davis AI learns individual baselines — not global thresholds
- Problem cards include impact scope, root cause, and evidence
- Completely automatic — no alert rules or thresholds configured
- Time from injection to detection: ~1-2 minutes
- Applicable to any type of anomaly: response time, error rate, CPU, memory

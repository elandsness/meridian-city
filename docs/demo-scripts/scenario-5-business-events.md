# Demo Scenario 5: Business Process Observability (Business Events)

**Duration**: ~7 minutes  
**Dynatrace features**: Business Events, Business Analytics, funnel analysis, drop-off rates  
**Narrative**: "Every citizen request is a business process. Dynatrace turns structured logs into business insights — without touching the application code."

---

## Setup

- Public Portal open: http://localhost:8080
- Dynatrace open on **Business Analytics** (search for "Service Request Journey" funnel)
- Business Events must be configured per [dynatrace-config-guide.md](../dynatrace-config-guide.md) Section 3

---

## Script

### 1. Set the scene (1 min)

> "Most observability tools tell you whether your application is healthy. Dynatrace Business Events let us ask a different kind of question: are our business processes healthy? Are citizens actually completing their service requests, or are they dropping off? Where in the process are we losing them?"

In Dynatrace Business Analytics:
> "This is the Service Request Journey funnel. It shows how citizen requests move through our system — from initial submission all the way to resolution."

### 2. Walk through Flow A: Service Request Lifecycle (2 min)

Point to each step in the funnel:
1. **Submitted** — "This is every request that came in. About 100 today."
2. **Validated** — "Slightly fewer — some were rejected by the validation logic."
3. **Dispatched** — "Routed to the right department."
4. **Assigned** — "Point out any significant drop here"
5. **Status Updated** — "Each status change emits one
   `service_request.status_updated` event carrying `new_status`; filter on it to
   see how many reached `in_progress`, `resolved`, etc."

> "What you're looking at is built entirely from structured log lines. No database queries, no custom metrics — Dynatrace is extracting these business events from the application logs in real time."

Click on one event in the funnel:
> "I can drill into any individual request ID and see its exact progression through the pipeline — when it was submitted, how long dispatch took, who it was assigned to."

### 3. Show Flow B: Citizen Registration (1 min)

> "Registration is a single business event today — `citizen.registered`, one per
> sign-up. You can chart registrations over time and segment by zone, all from a
> log line — no developer built an analytics pipeline."

> "If we wanted a full conversion funnel (started → details → verified →
> activated), the app would emit those intermediate `account.*` events. It's a
> clean example of how you extend Business Events as the product grows — pure
> tenant config plus a few log lines, no analytics pipeline to build."

### 4. Show Flow C: IoT Incident Resolution (1 min)

Navigate to the IoT Incident Resolution Funnel:
> "And here's an operational flow: when our IoT systems detect a problem, how
> quickly do we move from detection to a work order? The emitted steps are
> `iot.anomaly_detected` → `incident.created` → `workorder.created`."

Point out the time axis:
> "I can measure the time between each step — e.g. detection to work-order
> creation. Later stages like acknowledgment/resolution live in the operational
> data today; emit `workorder.*` status events to extend the funnel and alert on
> an SLA breach."

### 5. KPI metrics (1 min)

In Business Analytics → create a simple metric:
> "I can define business KPIs directly from these events. For example: 'average time from service_request.submitted to service_request.resolved' — that's our citizen request resolution time. Or 'percentage of requests that reach resolved within 48 hours' — that's our SLA compliance rate."

> "These KPIs are real business metrics, derived from application telemetry. They tell the story of what your application is actually doing for its users."

### 6. Tie it back to DXC (30 sec)

> "For DXC's customers, this is the bridge between IT operations and business outcomes. Instead of showing a CIO a CPU utilization graph, you show them a service request completion rate and a trend over time. Dynatrace Business Events makes that possible — without changing a line of application code."

---

## Key talking points

- Business Events are extracted from structured logs — zero code changes required
- Any structured log line can become a business process step
- Funnel analysis shows conversion rates, drop-off, and bottlenecks
- Business KPIs (SLA compliance, resolution time) derived from telemetry
- Three distinct flows — citizen requests, account registration, IoT incident resolution
- Bridge between IT observability and business outcomes

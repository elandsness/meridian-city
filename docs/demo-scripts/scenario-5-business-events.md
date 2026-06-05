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
5. **In Progress** — "Work has started."
6. **Resolved** — "What percentage made it all the way to resolution?"

> "What you're looking at is built entirely from structured log lines. No database queries, no custom metrics — Dynatrace is extracting these business events from the application logs in real time."

Click on one event in the funnel:
> "I can drill into any individual request ID and see its exact progression through the pipeline — when it was submitted, how long dispatch took, who it was assigned to."

### 3. Show Flow B: Account Registration (1 min)

Navigate to the Account Registration Funnel:
> "Here's the citizen account creation flow. This looks more like an e-commerce conversion funnel — did citizens who started registration actually complete it? Where did they abandon the process?"

Point out the verification step:
> "Interesting — there's a drop at the 'verification sent' to 'verified' step. That might mean our email verification UX needs work, or that some citizens are using disposable email addresses."

> "The business team can now act on this insight. And all they needed was Dynatrace's log processing rule — no developer had to build a custom analytics pipeline."

### 4. Show Flow C: IoT Incident Resolution (1 min)

Navigate to the IoT Incident Resolution Funnel:
> "And here's an operational flow — when our IoT systems detect a problem, how quickly do we move from detection to resolution? Are work orders getting acknowledged? Are they getting resolved?"

Point out the time axis:
> "I can measure the time between each step. If work orders are sitting in 'assigned' for more than 4 hours without an acknowledgment, that's an SLA breach. Dynatrace can alert on that."

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

# Demo Scenario 1: End-to-End Distributed Trace

**Duration**: ~5 minutes  
**Dynatrace features**: Distributed traces, service flow, SQL visibility, Kafka publish  
**Narrative**: "Watch a citizen's service request travel end-to-end in a single distributed trace."

> **Updated for the generic entity platform:** the service-request lifecycle
> (submit → dispatch → work order) that used to span three Java services
> (`citizen-service` → `service-dispatch` → `city-operations`) is now handled
> inside **one** generic service, `workflow-service` — those three services no
> longer exist. The synchronous trace below is shorter as a result
> (api-gateway → workflow-service, with the Kafka hop to notification-service
> still async/separate). If you want a genuinely multi-hop cross-service trace
> for this talk track, use a custom entity type routed through
> `customer-entity-service` → `routing-service` instead (any industry overlay
> that keeps `routing-service` in the loop for its entities), or use the
> `journey-service` → `movement-service` fleet flow (Scenario 3-style) which is
> inherently multi-service.

---

## Setup

- Public Portal is open in a browser tab: http://localhost:8080, **logged in**
  (operator `demo` / `dynatrace`, or a registered citizen's email + password)
- Dynatrace is open in a second tab on **Observe and Explore → Distributed Traces**
- A second Dynatrace tab on **Services** (or **Service Flow**)

---

## Script

### 1. Set the scene (30 sec)

> "Every time a citizen interacts with our city platform, their request travels through multiple services. Dynatrace gives us complete visibility across that entire journey — automatically, with no code changes. Let me show you what that looks like."

### 2. Submit a service request (1 min)

In the Public Portal:
1. Go to **Service Requests → New Service Request** (`/service-requests/new`)
2. Fill in: Category = Infrastructure, **Title** = "Pothole on Elm Street" (required),
   Description = optional details, Priority = Normal
3. Click **Submit**
4. You're returned to the request list with the new request at the top — note its
   `req-…` id there

### 3. Find the trace in Dynatrace (1 min)

In Dynatrace Distributed Traces:
1. Filter by **Service = api-gateway** and **Time = Last 5 minutes**
2. Find the POST request for `/api/v1/service-requests`
3. Click to open the trace

### 4. Walk through the trace waterfall (2 min)

Point out:

- **api-gateway** → receives the HTTP request from the citizen's browser, proxies to `workflow-service`
- **workflow-service** → validates the request, writes it to PostgreSQL (SQL query visible — point out the table name and parameters), applies dispatch/priority logic, creates the linked work order (another SQL write), then publishes to Kafka `workflow.events`

> notification-service consumes `workflow.events` asynchronously and creates the
> in-app notification — it appears as a separate (Kafka-linked) trace, not part
> of this synchronous waterfall.

> "Dynatrace captured this entire flow automatically. I didn't add a single line of monitoring code. And notice — I can see the exact SQL query, the database host, even the execution time at each step."

### 5. Show the Service Flow (1 min)

Switch to **Services → workflow-service → Service Flow**:

> "Here's the service dependency map for workflow-service. Dynatrace builds this automatically from live traffic. You can see all the upstream callers and downstream dependencies — and the health of each connection."

### 6. Optional: Show a slow trace comparison

Use the Demo Control Panel to inject a DB slowdown, then submit another request. Compare the two traces side by side.

---

## Key talking points

- Zero-code instrumentation via OneAgent
- Full end-to-end visibility including SQL and message queue
- Automatic service dependency mapping
- This trace spans Node.js (`api-gateway`) and Java (`workflow-service`); the platform also instruments Python and Go (see Scenarios 3 & 4), and a custom industry's own entity types can add more hops through `customer-entity-service`/`ops-entity-service` and `routing-service`

# Demo Scenario 1: End-to-End Distributed Trace

**Duration**: ~5 minutes  
**Dynatrace features**: Distributed traces, service flow, SQL visibility, Kafka publish  
**Narrative**: "Watch a citizen's service request travel through four services in a single distributed trace."

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

- **api-gateway** → receives the HTTP request from the citizen's browser
- **citizen-service** → validates the request, writes to PostgreSQL (SQL query visible — point out the table name and parameters), then publishes to Kafka `requests.events`
- **service-dispatch** → routes based on category and zone; another SQL write visible
- **city-operations** → creates the work order (SQL write)

> notification-service consumes `requests.events` asynchronously and creates the
> in-app notification — it appears as a separate (Kafka-linked) trace, not part
> of this synchronous four-service waterfall.

> "Dynatrace captured this entire flow automatically. I didn't add a single line of monitoring code. And notice — I can see the exact SQL query, the database host, even the execution time at each step."

### 5. Show the Service Flow (1 min)

Switch to **Services → citizen-service → Service Flow**:

> "Here's the service dependency map for citizen-service. Dynatrace builds this automatically from live traffic. You can see all the upstream callers and downstream dependencies — and the health of each connection."

### 6. Optional: Show a slow trace comparison

Use the Demo Control Panel to inject a DB slowdown, then submit another request. Compare the two traces side by side.

---

## Key talking points

- Zero-code instrumentation via OneAgent
- Full end-to-end visibility including SQL and message queue
- Automatic service dependency mapping
- This trace spans Node.js (api-gateway) and Java (citizen-service, service-dispatch, city-operations); the platform also instruments Python and Go (see Scenarios 3 & 4)

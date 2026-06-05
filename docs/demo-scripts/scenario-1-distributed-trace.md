# Demo Scenario 1: End-to-End Distributed Trace

**Duration**: ~5 minutes  
**Dynatrace features**: Distributed traces, service flow, SQL visibility, Kafka publish  
**Narrative**: "Watch a citizen's service request travel through 5 services in a single distributed trace."

---

## Setup

- Public Portal is open in a browser tab: http://localhost:8080
- Dynatrace is open in a second tab on **Observe and Explore → Distributed Traces**
- A second Dynatrace tab on **Services** (or **Service Flow**)

---

## Script

### 1. Set the scene (30 sec)

> "Every time a citizen interacts with our city platform, their request travels through multiple services. Dynatrace gives us complete visibility across that entire journey — automatically, with no code changes. Let me show you what that looks like."

### 2. Submit a service request (1 min)

In the Public Portal:
1. Click **Report an Issue** (or **New Service Request**)
2. Fill in: Category = "Infrastructure", Description = "Pothole on Elm Street"
3. Click **Submit**
4. Note the Request ID shown on the confirmation screen (e.g., `req-00901`)

### 3. Find the trace in Dynatrace (1 min)

In Dynatrace Distributed Traces:
1. Filter by **Service = api-gateway** and **Time = Last 5 minutes**
2. Find the POST request for `/api/v1/service-requests`
3. Click to open the trace

### 4. Walk through the trace waterfall (2 min)

Point out:

- **api-gateway** → receives the HTTP request from the citizen's browser
- **citizen-service** → validates the request, writes to PostgreSQL (SQL query visible — point out the table name and parameters)
- **service-dispatch** → routes based on category and zone; another SQL write visible
- **city-operations** → creates the work order; SQL write + Kafka publish to `requests.events`
- **notification-service** → Kafka consume, creates the in-app notification

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
- Works across Java, Node.js, Python, and Go — all visible in a single trace

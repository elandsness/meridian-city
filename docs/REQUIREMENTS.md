# Meridian City — Product Requirements

> Status: living document. Owns *what* the app supplies and *how it behaves*.
> See [PLAN.md](PLAN.md) for the build sequence and [INSTRUMENTATION.md](INSTRUMENTATION.md)
> for how every behavior is observed in Dynatrace.

## Purpose

Meridian City is a microservices demo whose reason for existing is to **showcase
Dynatrace**. Every feature below is chosen because it produces a compelling
observability story — distributed traces, RUM user sessions, logs Dynatrace can
consume, AI/LLM observability, and business events that feed funnels. A feature
is not "done" until its instrumentation is done (see [INSTRUMENTATION.md](INSTRUMENTATION.md)).

The app has two front doors:
- **public-portal** — the citizen-facing experience (a real city would ship this).
- **ops-dashboard** — the operator + demo-driver surface (incident/request handling,
  IoT fleet, and the demo control room).

## Locked decisions

| Decision | Choice |
| --- | --- |
| Visual identity | Bold Meridian brand — deep civic blue `#0C447C` + amber "noon sun" accent `#EF9F27`; home reimagined as a live city dashboard |
| New domains | Net-new microservices: `commerce-service` (store) and `billing-service` (tax) |
| Front-end sessions | Dynatrace RUM (agentless JS snippet) in both SPAs |
| AI observability | OpenLLMetry (Traceloop SDK), replacing manual `gen_ai.*` span attributes |
| Build sequencing | Balanced vertical slices — each stage ships a feature *and* its instrumentation; the app stays demoable throughout |

## Brand language (approved mockups)

Two mockups set the visual language and information architecture:

1. **Citizen portal home** — a live city dashboard: a "Live" incidents feed, a
   per-citizen **messages inbox**, an **IoT device map** with health/warning/alert
   status dots, a balance-due stat, quick-action cards (City store, Pay taxes, New
   request, Ask Meri), and a persistent "Ask Meri" assistant.
2. **City store** — a product grid (mug, t-shirt, bumper sticker, dog sweater), a
   cart, a one-click **Buy now** (no payment or address), and an order **timeline**:
   placed → packed → shipped → delivered.

Palette and components are codified as Tailwind tokens + a shared `src/ui/` set
(see [PLAN.md](PLAN.md) Stage 0).

---

## Citizen portal requirements

### CP-1 — Live incidents on the main page
Citizens see a continuously updating list of active city incidents on the home
page (severity, location/zone, status, time-ago). Updates without a manual
refresh (react-query polling; the messages feed uses the existing SSE stream).
- Source: `GET /api/v1/incidents?status=open` (city-operations).

### CP-2 — Register & log in (per-citizen identity)
Citizens register with a unique email + password and log in to a personal
account. Identity is the real `citizen_id` minted by the gateway citizen-login
flow — **never** the mock `demo/dynatrace` operator token, and never a hardcoded
seeded citizen.
- Source: `POST /api/v1/citizens` (register), `POST /api/v1/auth/login` (login).
- Already implemented (commit `b60fde1`); this effort reskins it and wires
  `dtrum.identifyUser(email)`.

### CP-3 — Submit a service request
Citizens submit a request (category, title, description, priority, location) that
is routed to the operations team and tracked through its lifecycle with a status
**timeline**.
- Source: `POST /api/v1/service-requests`, `GET /api/v1/service-requests?citizen_id=`.

### CP-4 — IoT device map with statuses
Citizens see a city map of monitored IoT devices, each rendered with its current
status (healthy / warning / alert) and tied to any open incident.
- Source: `GET /api/v1/devices` (new aggregation endpoint in telemetry-processor).

### CP-5 — Tax & billing (simulated)
Citizens see all outstanding bills and a paid-bill history that resembles a
**quarterly** tax schedule, and can pay a bill with a single action (simulated —
no real payment). The bill history is **generated at registration** with a random
length; most older quarters are paid, the latest one or two are outstanding.
- Source: `GET /api/v1/billing/bills?citizen_id=&status=`, `POST /api/v1/billing/bills/{id}/pay`
  (new billing-service). Generation triggered by the `citizen.registered` event.

### CP-6 — City store (merchandise + simulated commerce)
Citizens buy Meridian City merchandise — a coffee mug, t-shirt, bumper sticker,
and a sweater for your dog. The shopping cart functions. Checkout is a single
**Buy now** button with **no payment or address** required. The order then
advances on simulated timers and emits business events at each step:
- `cart.item_added` → `checkout.completed` → `order.packed` → `order.shipped` →
  `order.delivered`.
- On delivery, a **"Your package has arrived"** message lands in the citizen's
  messages inbox (CP-7).
- Source: `GET /api/v1/store/products`, cart ops, `POST /api/v1/store/checkout`,
  `GET /api/v1/store/orders?citizen_id=` (new commerce-service).

### CP-7 — Messages inbox
A per-citizen inbox on the home page (distinct from the global ops notification
bell) collecting: package-delivered, service-request-resolved, and tax (issued /
paid) messages. Supports unread state and mark-read.
- Source: `GET /api/v1/messages?citizen_id=`, `POST /api/v1/messages/{id}/read`
  (notification-service, now DB-backed + per-citizen).

### CP-8 — AI assistant ("Ask Meri")
A persistent chatbot that responds **as if Meridian City is real** — as if the
citizen could actually reach city services via a service request or a (fake)
phone number, e.g. `1-555-MERIDIAN`. It can look up request status and report
current incidents.
- Source: `POST /api/v1/chat` (ai-service). Reskinned, persistent across routes.

---

## Ops dashboard / demo control requirements

### OPS-1 — Incident interaction
Operators click into an incident and act on it: read full detail, add comments,
and close/resolve it.
- Source: `GET /api/v1/incidents/{id}`, `GET/POST /api/v1/incidents/{id}/comments`,
  `PATCH /api/v1/incidents/{id}` (new handlers on city-operations).

### OPS-2 — Service request handling
Operators see the queue of citizen service requests and respond — assign and
advance status through the lifecycle.
- Source: `GET /api/v1/service-requests`, status update (existing citizen-service
  `updateStatus`).

### OPS-3 — Traffic handles open user requests
The traffic generator picks up **real** user-submitted service requests and
progresses them (dispatched → assigned → in_progress → resolved) so the business-
event funnels populate and inbox messages fire — making the demo self-sustaining.
- Source: new traffic-bot `handleOpenRequests` journey.

### OPS-4 — IoT fleet management
Operators see the list of IoT devices, each device's status, and a link to any
open incident for that device.
- Source: `GET /api/v1/devices` (status + `open_incident_ids` per device).

### OPS-5 — Demo control room
Operators start/stop traffic and scenarios with **ample live visuals** showing
what is running and at what level — counters for sessions, spans, incidents,
orders, and requests generated, plus traffic rate.
- Source: existing demo-control-api (traffic/fault/fleet/scenarios) + new live
  counters sourced from analytics KPIs, incidents, and order/request counts.

### OPS-6 — Demo scenarios + inline guide
Operators start a demo scenario **and** read its guide inline — the
`docs/demo-scripts/*.md` content rendered in the page — so they know what each
scenario does and how to present it.
- Source: existing scenario start endpoints; demo-script markdown rendered with
  `react-markdown`.

---

## Acceptance criteria (per slice)

Each slice is accepted when:
1. The user-facing behavior works end-to-end against the deployed cluster.
2. The API contract checklist in [API_CONVENTIONS.md](API_CONVENTIONS.md) passes
   for every new/changed endpoint (snake_case, gateway prefix verbatim, body
   re-serialization, defensive frontend unwrap, no required-param-that-500s).
3. Its instrumentation is verified in Dynatrace per [INSTRUMENTATION.md](INSTRUMENTATION.md):
   the relevant RUM user actions, distributed traces, business events, and (where
   applicable) funnel stages are visible.

Per-slice specifics live in [PLAN.md](PLAN.md).

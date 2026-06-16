# Meridian City — Build Plan & Tracker

> Status: living tracker. Pairs with [REQUIREMENTS.md](REQUIREMENTS.md) (what) and
> [INSTRUMENTATION.md](INSTRUMENTATION.md) (how it's observed). Each stage is one
> reviewable PR-sized vertical slice that ships a feature **and** its
> instrumentation, so the app stays demoable throughout.

## Conventions
- A change is not running until its PR merges to `main` and CI builds the image
  (`.github/workflows/build.yml`). PRs are created via the GitHub web UI.
- Helm uses floating `:latest` + `imagePullPolicy: Always`; redeploy with
  `scripts/deploy.sh` and verify the Vite bundle hash changed in the browser.
- New Java services mirror `services/city-operations`. New endpoints follow
  [API_CONVENTIONS.md](API_CONVENTIONS.md).

## Legend
`[ ]` not started `[~]` in progress `[x]` done

---

## Stage 0 — Discovery & foundations (review checkpoint)
*Goal: agree the written requirements and stand up the brand + RUM foundation
everything else builds on. No new user-facing feature.*

- [x] `docs/REQUIREMENTS.md`, `docs/INSTRUMENTATION.md`, `docs/PLAN.md`
- [x] Brand tokens in both `tailwind.config.js` (`meridian.blue`, `noon.sun`)
- [x] Shared `src/ui/` set: `Card`, `Button`, `Badge`, `StatTile` (built in Stage 1
      where they render; `Timeline` deferred to Stage 3, ops `src/ui/` to Stage 4)
- [x] `src/lib/rum.js` dtrum wrapper in both apps
- [x] RUM injection: split `frontend-nginx-configmap.yaml` per app, `sub_filter`,
      `values.yaml` `rum:` blocks, pod `checksum/config` annotation
- [x] Wire `identifyUser(email)` in both `AuthContext.jsx`; `reportError` in both
      `api/client.js`

**Instrumentation:** RUM sessions / replay / Core Web Vitals / JS errors live in
both SPAs; sessions tagged with citizen email.

---

## Stage 1 — Citizen dashboard home + live incidents
- [x] Shared `src/ui/` components (Card, Button, Badge, StatTile)
- [x] Reskin `Layout.jsx` to the Meridian brand (blue/amber top nav, avatar)
- [x] Rebuild `public-portal/src/pages/Home.jsx` as the live city dashboard
      (StatTiles, live incident feed w/ 30s poll, map, messages preview, quick actions)
- [x] Lift `ChatWidget` into the layout (persistent) via `ChatContext`; brand reskin
- [ ] Follow-up: reskin `Login.jsx` / `Register.jsx` / `ServiceRequests.jsx` /
      `NewRequest.jsx` to the light brand (still dark-slate) — pending

**Instrumentation:** RUM user actions on quick actions; incident poll + SSE feed
visible in session detail.

---

## Stage 2 — AI chat + OpenLLMetry
- [ ] Reskin persistent `ChatWidget`; fix the `data.response` read; bake the
      "Meridian is real" persona + fake phone number
- [ ] OpenLLMetry migration in ai-service (`requirements.txt`, `otel.py`, `chat.py`)
- [ ] `chat.send` RUM action carrying `session.id`

**Instrumentation:** AI Observability shows OpenLLMetry `gen_ai` spans + token
usage; `chatbot.interaction` business-event log preserved.

---

## Stage 3 — Service-request slice
- [ ] Portal `NewRequest` / `ServiceRequests` with status `Timeline`
- [ ] Ops `RequestQueue` page (existing `updateStatus`)
- [ ] `service_request.submit` RUM action + `request.id`

**Instrumentation:** RUM action joins Flow A funnel on `request.id`.

---

## Stage 4 — Incident management (ops)
- [ ] city-operations: `GET /incidents/{id}`, `GET/POST /incidents/{id}/comments`,
      `PATCH /incidents/{id}`; `V3__incident_comments.sql` + `IncidentComment`
- [ ] Ops `IncidentDetail` page (link from list; comment box; close button)
- [ ] `incident.commented` / `incident.resolved` business events

**Instrumentation:** new events extend Flow C (IoT incident resolution).

---

## Stage 5 — City store (commerce)
- [ ] `commerce-service` (products/cart/checkout/orders + `@Scheduled` fulfillment
      state machine) + `commerce.events` topic + `/admin/fault`
- [ ] Portal `Store` / `Cart` / `Orders` with order `Timeline`
- [ ] gateway `/api/v1/store` route + Helm template + values block
- [ ] traffic-bot `storePurchase` journey
- [ ] `cart.item_added` / `checkout.completed` / `order.packed` / `order.shipped`
      / `order.delivered` events; `store.add_to_cart` + `store.checkout` RUM actions

**Instrumentation:** Purchase funnel (Flow D) + Checkout Success SLO; commerce
service-map node with DB + Kafka spans.

---

## Stage 6 — Tax / billing
- [ ] `billing-service` (bills + pay + quarterly history generation) +
      `billing.events` topic
- [ ] citizen-service publish hook → `citizens.events`; billing consumes it
- [ ] Portal `Billing` page + Home balance-due tile
- [ ] gateway `/api/v1/billing` route + Helm template + values block
- [ ] traffic-bot `payTax` journey
- [ ] `tax.bill_issued` / `tax.payment_completed` events; `tax.pay` RUM action

**Instrumentation:** Tax Payment funnel (Flow E) + Payment Availability SLO.

---

## Stage 7 — Messages inbox + IoT status + demo-control upgrade
- [ ] notification-service: Postgres + `messages` schema; consume
      `commerce.events` / `billing.events` / `requests.events`; `/api/v1/messages`
- [ ] Portal `Messages` inbox + IoT status map; "Your package has arrived" closes
      the loop
- [ ] telemetry-processor `GET /api/v1/devices` aggregation + gateway `/api/v1/devices`
- [ ] Ops IoT fleet device → incident links
- [ ] Demo control: live counters (sessions/spans/incidents/orders/requests) +
      inline `docs/demo-scripts/*.md` rendering (`react-markdown`)
- [ ] traffic-bot `handleOpenRequests` journey

**Instrumentation:** live counters from analytics KPIs + incident/order counts;
the full purchase → delivery → inbox loop is observable end-to-end.

---

## Cross-cutting doc updates (land with their slice)
- [ ] `dynatrace-config-guide.md`: Flow D/E funnels, new SLOs, RUM tiles,
      OpenLLMetry note, log-source matchers for commerce/billing
- [ ] `API_CONVENTIONS.md`: register `/store`, `/billing`, `/messages`, `/devices`;
      reaffirm "real citizen id, not `user.id`"
- [ ] `architecture.md`: new services + Kafka topics

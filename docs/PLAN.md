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
- [x] Reskin `Login.jsx` / `Register.jsx` / `ServiceRequests.jsx` / `NewRequest.jsx`
      to the light brand (+ shared `AuthShell`, `ui/form.js`, `requestStatusMeta`)

**Instrumentation:** RUM user actions on quick actions; incident poll + SSE feed
visible in session detail.

---

## Stage 2 — AI chat + OpenLLMetry
- [x] Reskin persistent `ChatWidget` (Stage 1); harden `data.response` read; bake the
      "Meridian is real" persona + fake phone (1-555-MERIDIAN) in ai-service prompt
- [x] OpenLLMetry migration in ai-service (`requirements.txt` → traceloop-sdk;
      `otel.py` → `Traceloop.init`; `chat.py` → drop manual `gen_ai.*`, keep
      session.id parent span + association property + `chatbot.interaction` log)
- [x] `chat.send` RUM action carrying `session.id`
- [x] `dynatrace-config-guide.md` §7 note: spans now via OpenLLMetry

**Instrumentation:** AI Observability shows OpenLLMetry `gen_ai` spans + token
usage; `chatbot.interaction` business-event log preserved; session.id ties the
LLM interaction to its RUM session.

---

## Stage 3 — Service-request slice
- [x] `Timeline` ui primitive + portal `RequestDetail` page (status timeline);
      `ServiceRequests` rows now link to detail
- [x] Ops `RequestQueue` page (list + advance via `updateStatus`; dark ops theme)
      + `api/requests.js` + nav/route
- [x] `service_request.submit` RUM action carrying `request.id` (from response)

**Instrumentation:** RUM action joins Flow A funnel on `request.id`.

> Note: ops-dashboard keeps its dark/data-forward aesthetic (cyan accents) — a
> defensible "operator console" look distinct from the light citizen portal; a
> full ops brand reskin can be a later polish pass if desired.

---

## Stage 4 — Incident management (ops)
- [x] city-operations: `GET /incidents/{id}`, `GET/POST /incidents/{id}/comments`,
      `PATCH /incidents/{id}`; `V3__incident_comments.sql` + `IncidentComment`
      entity/repo + DTOs; `source` added to `IncidentResponse`
- [x] Ops `IncidentDetail` page (rows link instead of expand; comments; resolve/reopen)
- [x] `incident.commented` / `incident.resolved` business events

**Instrumentation:** new events extend Flow C (IoT incident resolution).
No gateway/Helm change — `/api/v1/incidents` already routes to city-operations.

---

## Stage 5 — City store (commerce)
- [x] `commerce-service` (products/cart/checkout/orders + `@Scheduled` fulfillment
      state machine) + `commerce.events` topic + `/admin/fault` (29 Java files)
- [x] Portal `Store` (grid + cart + Buy now) / `Orders` (live lifecycle Timeline);
      nav + Home quick action + `formatCents`
- [x] gateway `/api/v1/store` route + Helm template + values block + CI matrix
- [x] traffic-bot `storePurchase` journey (+ SCENARIO_STORE_PURCHASE wiring)
- [x] `cart.item_added` / `checkout.completed` / `order.packed` / `order.shipped`
      / `order.delivered` events; `store.add_to_cart` + `store.checkout` RUM actions
- [ ] Pending (tenant/ops): add `purchase` to `analytics-service/funnels.py` so the
      ops Business Analytics page renders Flow D; add Flow D detail to
      `dynatrace-config-guide.md` §3 (funnel is configured in the Dynatrace UI)

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

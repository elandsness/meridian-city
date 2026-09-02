# Generic Entity Engine Branch — Audit & Refactoring Report

**Branch:** `epic/generic-entity-engine`  
**Date:** 2026-08-27  
**Status:** Complete Audit

---

## Vision & North Star

**This is a demo platform, not a production SaaS.** The goal is to create a **generic entity engine** that can be **reskinned with zero code changes** to create realistic web experiences for different industries (airport, bank, hospital, sports team, utility), each of which can be **instrumented with Dynatrace** for live demo flows (e.g., "book a trip" → show the trace in Dynatrace).

### The "Generic" Promise

A config file should be able to:
- **Reskin** the entire application (colors, logo, terminology, branding)
- **Rename** entities and actions (tax payment → credit card payment → season ticket deposit)
- **Scaffold** a home page from a library of generic components
- **Compose** a set of pages that create a realistic demo experience
- **Instrument** with Dynatrace business flows automatically

**ZERO code changes should be required.** If a reskin requires code changes, the platform is not generic.

### Demo Flow Priority

1. **User interacts with the frontend** (books a trip, pays a bill, checks flight status)
2. **Dynatrace captures the trace** (frontend → API gateway → backend service → database)
3. **Presenter shows the trace in Dynatrace** (demonstrates observability, business flows, AI insights)
4. **Presenter switches industries** (changes config, refreshes, shows same flow in different context)

The platform must enable this flow **reliably and quickly**. Complexity should serve this flow, not hinder it.

---

## Key Findings at a Glance

| Category | Status | Impact on Demo Goal |
|----------|--------|---------------------|
| **Configuration-Driven Design** | 🟡 Partial | **BLOCKER** — Core promise not fulfilled |
| **Component Library** | 🟡 Partial | **BLOCKER** — No library to reskin from |
| **Dynatrace Instrumentation** | 🟢 Good | Works, but can be improved |
| **Security** | 🟡 Acceptable | Demo app, not production — lower priority |
| **Test Coverage** | 🟡 Acceptable | Demo app — lower priority |
| **Architecture** | 🟢 Sound | Entity engine design is solid |

---

## 1. The "Generic" Promise — What Needs to Change

The core promise of this platform is **zero-code reskinning**. If a reskin requires code changes, the platform is not generic. Currently, the platform is **~60% generic** — the entity engine works, but the frontend experience is hardcoded.

### 1.1 What IS Generic (Working)

| Component | Status | Notes |
|-----------|--------|-------|
| **Entity Engine** | ✅ Generic | Schema-driven, configurable fields/states/transitions |
| **Theme Colors** | ✅ Generic | Configurable brand colors, accents, tints |
| **Terminology** | ✅ Generic | Customer → citizen, incident → fault, etc. |
| **Screen Registry** | ✅ Generic | Screens defined in config, not code |
| **Home Modules** | ✅ Generic | Home page modules defined in config |
| **Entity Templates** | ✅ Generic | List/detail/map/analytics/journey are generic |
| **Dynatrace Flows** | ✅ Generic | Business flows derived from entity config |

### 1.2 What IS NOT Generic (Hardcoded)

| Component | Status | Impact |
|-----------|--------|--------|
| **WeatherWidget** | ❌ Hardcoded | "75°, Sunny" — not configurable |
| **NewsTicker** | ❌ Hardcoded | Hardcoded headlines |
| **TransitPanel** | ❌ Hardcoded | Hardcoded transit topology |
| **ChatWidget** | ❌ Hardcoded | Assistant name "Meri" hardcoded |
| **Login Page** | ❌ Hardcoded | Demo credentials visible in UI |
| **Entity Definitions** | ❌ Partial | Some entities hardcoded, some config-driven |
| **Page Composition** | ❌ Hardcoded | Home page structure hardcoded |
| **Industry Examples** | ❌ Hardcoded | Airport/bank/hospital are code, not config |

### 1.3 The Reskinning Model

For true zero-code reskinning, the platform needs:

**1. Industry Config File** (`industry-config.json`)
```json
{
  "id": "airport",
  "name": "Meridian Airport",
  "branding": {
    "colors": { "brand": "#0C447C", "accent": "#EF9F27" },
    "logo": "/airport-logo.svg",
    "favicon": "/airport-ico.ico"
  },
  "terminology": {
    "customer": "Passenger",
    "customerPlural": "Passengers",
    "request": "Flight booking",
    "requestPlural": "Flight bookings",
    "incident": "Disruption",
    "incidentPlural": "Disruptions"
  },
  "entities": [
    { "id": "flight", "label": "Flight", "pluralLabel": "Flights" },
    { "id": "gate", "label": "Gate", "pluralLabel": "Gates" },
    { "id": "boardingPass", "label": "Boarding Pass", "pluralLabel": "Boarding Passes" }
  ],
  "homeModules": ["weather", "news-ticker", "transit-map", "quick-actions"],
  "pages": ["home", "flights", "gates", "boarding-passes", "analytics"],
  "dynatrace": {
    "businessFlow": "Flight Booking",
    "provider": "Airport Demo"
  }
}
```

**2. Component Library** (generic, reskinable components)
- `WeatherWidget` — Configurable forecast display
- `NewsTicker` — Configurable headlines
- `TransitPanel` — Configurable transit routes
- `ChatWidget` — Configurable assistant name/persona
- `EntityList` — Generic entity table
- `EntityDetail` — Generic entity detail view
- `EntityMap` — Generic entity map
- `EntityAnalytics` — Generic analytics dashboard

**3. Page Composition** (config-driven page builder)
```json
{
  "pages": {
    "home": {
      "modules": [
        { "type": "weather", "position": "top" },
        { "type": "news-ticker", "position": "top" },
        { "type": "entity-list", "entityType": "flight", "position": "middle" },
        { "type": "transit-map", "position": "bottom" }
      ]
    },
    "flights": {
      "modules": [
        { "type": "entity-list", "entityType": "flight" },
        { "type": "entity-map", "entityType": "flight" }
      ]
    }
  }
}
```

### 1.4 Action Items

1. **Define the reskinning model** — What can be configured? What requires code?
2. **Create the component library** — Generic, reskinable components
3. **Migrate hardcoded components** — Weather, NewsTicker, TransitPanel, ChatWidget
4. **Create the page composer** — Config-driven page builder
5. **Create industry config examples** — Airport, bank, hospital as config, not code

---

## 2. Security Issues (Demo App Context)

For a **demo application**, security is less critical than for production. The following issues are **acceptable for demos** if clearly labeled "DEMO ONLY" and not used in production.

### 2.1 Hardcoded Secrets (ACCEPTABLE FOR DEMOS)

**Current State:** Hardcoded credentials throughout (DB passwords, JWT secrets, API keys)

**Demo Context:**
- ✅ Acceptable if labeled "DEMO ONLY"
- ✅ Acceptable if not used in production
- ✅ Acceptable if credentials are not real prod credentials

**Recommendation:**
- Add "DEMO ONLY" comments to all hardcoded credentials
- Use obviously fake credentials (e.g., `demo-password-123`, not `meridian-secret-change-me`)
- Document that these are demo credentials only

### 2.2 No Authentication (ACCEPTABLE FOR DEMOS)

**Current State:** No auth on many endpoints

**Demo Context:**
- ✅ Acceptable for internal demos
- ⚠️ Problematic if demos are shared externally
- ⚠️ Problematic if multiple demo instances run on same cluster

**Recommendation:**
- Add basic auth for external-facing demos
- Use instance-specific credentials for multi-tenant demos
- Document auth requirements

### 2.3 SQL Injection (FIX FOR DEMOS)

**Current State:** SQL injection in notification-service

**Demo Context:**
- ❌ Not acceptable — breaks demos if exploited
- ❌ Unprofessional if demonstrated

**Recommendation:**
- Fix SQL injection (parameterize queries)
- This is a **demonstration of bad code** — fix it to show good code

### 2.4 Rate Limiting (LOW PRIORITY)

**Current State:** No rate limiting

**Demo Context:**
- ✅ Acceptable for controlled demos
- ⚠️ Problematic if demos are exposed to public internet

**Recommendation:**
- Add rate limiting if demos are exposed externally
- Otherwise, lower priority

### 2.5 CORS (ACCEPTABLE FOR DEMOS)

**Current State:** Wildcard CORS

**Demo Context:**
- ✅ Acceptable for demos
- ⚠️ Problematic if demos are exposed to public internet

**Recommendation:**
- Restrict CORS if demos are exposed externally
- Otherwise, lower priority

### 2.6 Token Storage (ACCEPTABLE FOR DEMOS)

**Current State:** localStorage for tokens

**Demo Context:**
- ✅ Acceptable for demos
- ⚠️ Problematic for production

**Recommendation:**
- Use httpOnly cookies for production
- For demos, localStorage is acceptable

### 2.7 Security Headers (LOW PRIORITY)

**Current State:** Missing security headers

**Demo Context:**
- ✅ Acceptable for demos
- ⚠️ Important for production

**Recommendation:**
- Add security headers for production
- For demos, lower priority

---

## 3. Test Coverage (Demo App Context)

### 3.1 Current State

| Service Type | Test Coverage | Demo Impact |
|--------------|---------------|-------------|
| **Java (entity-engine)** | 1 test file | Low — entity engine is stable |
| **Python services** | 0 tests | Medium — may break during demos |
| **Node.js services** | 0 tests | Medium — may break during demos |
| **Frontend** | 0 tests | High — UI breaks during demos |

### 3.2 Demo Impact

**Problem:** Zero test coverage means:
- Changes can break demos without detection
- Regression testing is manual and time-consuming
- Confidence in demo reliability is low

**Recommendation:**
- **Priority 1:** Add tests to frontend (most visible during demos)
- **Priority 2:** Add tests to entity engine (core platform)
- **Priority 3:** Add tests to Python/Node.js services

### 3.3 Demo Testing Strategy

For a demo platform, focus on:
1. **Demo flow tests** — Can I book a trip? Can I pay a bill?
2. **Reskin tests** — Can I change industry config and see changes?
3. **Dynatrace tests** — Are business flows captured?

**Not needed:**
- Unit tests for every function
- Integration tests for every endpoint
- Performance tests (unless specifically demoing performance)

---

## 4. Architecture Assessment

### 4.1 Entity Engine (SOLID)

**Current State:** Schema-driven, configurable entity management

**Strengths:**
- ✅ Configurable fields, states, transitions
- ✅ Generic entity templates (list, detail, map, analytics, journey)
- ✅ Event-driven (Kafka)
- ✅ Multi-tenant (instance hash)

**Weaknesses:**
- ⚠️ No pagination (may break with large datasets)
- ⚠️ No search (only filter by field)
- ⚠️ No sorting (only default order)

**Recommendation:**
- Add pagination (critical for large datasets)
- Add search (important for demo realism)
- Add sorting (nice-to-have)

### 4.2 Multi-tenancy (SOLID)

**Current State:** Instance hash mechanism

**Strengths:**
- ✅ Clean namespace isolation
- ✅ Per-instance Kafka, PostgreSQL, Dynatrace
- ✅ Shared operators (CloudNativePG, Strimzi, Dynatrace)

**Weaknesses:**
- ⚠️ No cross-tenant queries (by design)
- ⚠️ No tenant-aware auth (by design)

**Recommendation:**
- Current approach is good for demos
- No changes needed

### 4.3 Dynatrace Integration (SOLID)

**Current State:** Comprehensive, idempotent provision/deprovision

**Strengths:**
- ✅ Business flows derived from entity config (automated!)
- ✅ Per-instance isolation
- ✅ Pre-delete hook for cleanup
- ✅ Cluster monitoring ownership detection

**Weaknesses:**
- ⚠️ No Dynatrace SLO validation
- ⚠️ No automated demo scenario validation

**Recommendation:**
- Add Dynatrace SLO validation (optional)
- Add demo scenario validation (important for demos)

### 4.4 Helm Chart (SOLID)

**Current State:** Well-organized, documented

**Strengths:**
- ✅ Good helper functions
- ✅ Multi-industry support (values-*.yaml)
- ✅ Instance hash mechanism
- ✅ Comprehensive documentation

**Weaknesses:**
- ⚠️ No values.schema.json (validation)
- ⚠️ No deploy workflow (only build)

**Recommendation:**
- Add values.schema.json (nice-to-have)
- Add deploy workflow (important for demos)

---

## 5. Modern Best Practices (Demo App Context)

### 5.1 TypeScript (LOW PRIORITY)

**Current State:** All JavaScript

**Demo Context:**
- ✅ JavaScript is fine for demos
- ⚠️ TypeScript is better for maintainability

**Recommendation:**
- Migrate to TypeScript if time permits
- Not critical for demos

### 5.2 Modern Auth (LOW PRIORITY)

**Current State:** Basic JWT

**Demo Context:**
- ✅ Basic JWT is fine for demos
- ⚠️ OAuth 2.0 is better for production

**Recommendation:**
- Keep basic JWT for demos
- Add OAuth 2.0 for production

### 5.3 API Design (MEDIUM PRIORITY)

**Current State:** REST with custom patterns

**Demo Context:**
- ✅ REST is fine for demos
- ⚠️ OpenAPI specification is better for documentation

**Recommendation:**
- Add OpenAPI specification (important for demos)
- Consider GraphQL for complex queries (nice-to-have)

### 5.4 Database Migrations (MEDIUM PRIORITY)

**Current State:** Python services use `CREATE IF NOT EXISTS`

**Demo Context:**
- ⚠️ Problematic for demo reliability
- ⚠️ Schema changes can break demos

**Recommendation:**
- Add migrations to Python services (important for demos)
- Align with Java services' Flyway approach

### 5.5 Observability (SOLID)

**Current State:** OpenTelemetry + Dynatrace

**Strengths:**
- ✅ Distributed tracing
- ✅ Metrics
- ✅ Logging
- ✅ Business flows

**Recommendation:**
- Current approach is good for demos
- No changes needed

---

## 6. Recommendations by Priority (Demo Goal)

### 6.1 Immediate (Week 1-2) — Demo Blocking

1. **Define the reskinning model** — What can be configured? What requires code?
2. **Create the component library** — Generic, reskinable components
3. **Migrate hardcoded components** — Weather, NewsTicker, TransitPanel, ChatWidget
4. **Create the page composer** — Config-driven page builder
5. **Create industry config examples** — Airport, bank, hospital as config, not code

### 6.2 Short-term (Week 3-6) — Demo Reliability

1. **Add tests to frontend** — Demo flow tests
2. **Add tests to entity engine** — Core platform tests
3. **Add pagination** — Critical for large datasets
4. **Add search** — Important for demo realism
5. **Add OpenAPI specification** — Important for documentation

### 6.3 Medium-term (Week 7-12) — Demo Polish

1. **Add TypeScript** — If time permits
2. **Add OAuth 2.0** — For production
3. **Add progressive delivery** — For safer deployments
4. **Add dependency scanning** — For security
5. **Add secrets management** — For production

### 6.4 Long-term (Quarter 2+) — Production Readiness

1. **Add service mesh** — For observability
2. **Add SLO/SLI monitoring** — For reliability
3. **Add error tracking** — For debugging
4. **Consider Rust/Go** — For performance-critical services
5. **Add GitOps workflow** — For deployment

---

## 7. Conclusion

The generic entity engine branch has a **solid architectural foundation** with a well-designed entity engine and multi-tenancy model. The **configuration-driven design is partially implemented** (6/10), but the **component library is missing**, which is the core blocker for true zero-code reskinning.

### What's Working (For the Demo Goal)

1. ✅ Entity engine architecture is sound
2. ✅ Multi-tenancy works well
3. ✅ Dynatrace integration is comprehensive (automated business flows!)
4. ✅ Helm chart structure is good
5. ✅ Partial configuration-driven design (theme, terminology, screens, entity templates)

### What Blocks the Demo Goal

1. 🔴 **No component library** — No library of generic, reskinable components
2. 🔴 **No page composer** — No config-driven page builder
3. 🔴 **No reskinning model** — No clear definition of what can be configured
4. 🟡 **Incomplete configuration-driven design** — Many components hardcoded
5. 🟡 **No industry config examples** — Airport, bank, hospital are code, not config

### Final Recommendation

**Focus on the demo goal.** The architecture is sound, but the platform is not yet generic. Prioritize:

1. **Component library** — Generic, reskinable components
2. **Page composer** — Config-driven page builder
3. **Reskinning model** — Clear definition of what can be configured
4. **Industry config examples** — Airport, bank, hospital as config, not code

**Deprioritize:**
- Security hardening (demo app, not production)
- Test coverage (manual testing is acceptable for demos)
- TypeScript migration (JavaScript is fine)
- Modern auth (basic JWT is fine)
- Production deployment patterns (Helm is sufficient)

The "generic" promise can be fully realized with the recommended changes, making this a truly multi-industry demo platform.

---

## Appendix A: File Paths for Demo-Relevant Issues

### Hardcoded Credentials (Demo-Only, Label as Such)

- `services/entity-engine/src/main/resources/application.yml:13` — DB password default
- `services/api-gateway/src/app.js:13-15` — JWT secret, auth credentials
- `services/ai-service/ai_service/db.py:35` — DB password default
- `services/analytics-service/analytics_service/db.py:36` — DB password default
- `services/telemetry-processor/telemetry_processor/db.py:25` — DB password default
- `services/notification-service/src/db.js:22` — DB password default
- `services/traffic-bot/src/journeys/injectAnomaly.js:49` — Hardcoded auth credentials
- `helm/values.yaml:730` — Mock auth password
- `helm/values.yaml:1393` — PostgreSQL password (with "change before deploying" comment)
- `frontends/public-portal/src/pages/Login.jsx:82-85` — Demo credentials in UI
- `frontends/ops-dashboard/src/pages/Login.jsx:88-91` — Demo credentials in UI

### SQL Injection (Fix for Demo Reliability)

- `services/notification-service/src/messages.js:26-31` — `lim` parameter interpolated into SQL

### Missing Pagination (Demo Reliability)

- `services/entity-engine/src/main/java/com/meridian/entityengine/web/EntityController.java:23-34` — `page`/`limit` params accepted but dropped

### Missing Search (Demo Realism)

- `services/entity-engine/` — No search functionality, only filter by field

---

## Appendix B: Industry Config Examples

### Airport Industry Config (`industry-airport.json`)

```json
{
  "id": "airport",
  "name": "Meridian Airport",
  "tagline": "Your journey starts here.",
  "branding": {
    "colors": {
      "brand": "#0C447C",
      "brandDeep": "#082f57",
      "brandSoft": "#185FA5",
      "brandTint": "#E6F1FB",
      "accent": "#EF9F27",
      "accentSoft": "#f6b54e",
      "accentInk": "#412402"
    },
    "logo": "/airport-logo.svg",
    "favicon": "/airport-ico.ico"
  },
  "terminology": {
    "customer": "Passenger",
    "customerPlural": "Passengers",
    "request": "Flight booking",
    "requestPlural": "Flight bookings",
    "incident": "Disruption",
    "incidentPlural": "Disruptions",
    "workOrder": "Maintenance task",
    "asset": "Gate",
    "assetPlural": "Gates"
  },
  "entities": [
    { "id": "flight", "label": "Flight", "pluralLabel": "Flights" },
    { "id": "gate", "label": "Gate", "pluralLabel": "Gates" },
    { "id": "boardingPass", "label": "Boarding Pass", "pluralLabel": "Boarding Passes" },
    { "id": "bag", "label": "Bag", "pluralLabel": "Bags" }
  ],
  "homeModules": [
    { "type": "weather", "position": "top" },
    { "type": "news-ticker", "position": "top" },
    { "type": "entity-list", "entityType": "flight", "position": "middle" },
    { "type": "entity-map", "entityType": "gate", "position": "bottom" }
  ],
  "pages": ["home", "flights", "gates", "boarding-passes", "analytics"],
  "dynatrace": {
    "businessFlow": "Flight Booking",
    "provider": "Airport Demo",
    "pipeline": "Airport Pipeline"
  }
}
```

### Bank Industry Config (`industry-bank.json`)

```json
{
  "id": "bank",
  "name": "Meridian Bank",
  "tagline": "Your financial partner.",
  "branding": {
    "colors": {
      "brand": "#1E3A8A",
      "brandDeep": "#172554",
      "brandSoft": "#3B82F6",
      "brandTint": "#DBEAFE",
      "accent": "#10B981",
      "accentSoft": "#34D399",
      "accentInk": "#064E3B"
    },
    "logo": "/bank-logo.svg",
    "favicon": "/bank-ico.ico"
  },
  "terminology": {
    "customer": "Client",
    "customerPlural": "Clients",
    "request": "Transaction",
    "requestPlural": "Transactions",
    "incident": "Fraud alert",
    "incidentPlural": "Fraud alerts",
    "workOrder": "Audit task",
    "asset": "Account",
    "assetPlural": "Accounts"
  },
  "entities": [
    { "id": "account", "label": "Account", "pluralLabel": "Accounts" },
    { "id": "transaction", "label": "Transaction", "pluralLabel": "Transactions" },
    { "id": "loan", "label": "Loan", "pluralLabel": "Loans" },
    { "id": "card", "label": "Card", "pluralLabel": "Cards" }
  ],
  "homeModules": [
    { "type": "weather", "position": "top" },
    { "type": "news-ticker", "position": "top" },
    { "type": "entity-list", "entityType": "transaction", "position": "middle" },
    { "type": "chat-widget", "position": "bottom" }
  ],
  "pages": ["home", "accounts", "transactions", "loans", "cards", "analytics"],
  "dynatrace": {
    "businessFlow": "Transaction Processing",
    "provider": "Bank Demo",
    "pipeline": "Bank Pipeline"
  }
}
```

### Hospital Industry Config (`industry-hospital.json`)

```json
{
  "id": "hospital",
  "name": "Meridian Hospital",
  "tagline": "Your health, our priority.",
  "branding": {
    "colors": {
      "brand": "#059669",
      "brandDeep": "#047857",
      "brandSoft": "#34D399",
      "brandTint": "#D1FAE5",
      "accent": "#F59E0B",
      "accentSoft": "#FCD34D",
      "accentInk": "#78350F"
    },
    "logo": "/hospital-logo.svg",
    "favicon": "/hospital-ico.ico"
  },
  "terminology": {
    "customer": "Patient",
    "customerPlural": "Patients",
    "request": "Appointment",
    "requestPlural": "Appointments",
    "incident": "Critical alert",
    "incidentPlural": "Critical alerts",
    "workOrder": "Maintenance task",
    "asset": "Bed",
    "assetPlural": "Beds"
  },
  "entities": [
    { "id": "patient", "label": "Patient", "pluralLabel": "Patients" },
    { "id": "appointment", "label": "Appointment", "pluralLabel": "Appointments" },
    { "id": "bed", "label": "Bed", "pluralLabel": "Beds" },
    { "id": "equipment", "label": "Equipment", "pluralLabel": "Equipment" }
  ],
  "homeModules": [
    { "type": "weather", "position": "top" },
    { "type": "news-ticker", "position": "top" },
    { "type": "entity-list", "entityType": "appointment", "position": "middle" },
    { "type": "entity-map", "entityType": "bed", "position": "bottom" }
  ],
  "pages": ["home", "patients", "appointments", "beds", "equipment", "analytics"],
  "dynatrace": {
    "businessFlow": "Patient Appointment",
    "provider": "Hospital Demo",
    "pipeline": "Hospital Pipeline"
  }
}
```

---

## Appendix C: Component Library Specification

### Generic Components

| Component | Config Fields | Demo Use Case |
|-----------|---------------|---------------|
| `WeatherWidget` | `location`, `units` (metric/imperial) | Airport: "Weather at Meridian Airport" |
| `NewsTicker` | `headlines[]` (array of {title, url}) | Bank: "Market updates" |
| `TransitPanel` | `routes[]` (array of {name, stops[]}) | Airport: "Shuttle routes" |
| `ChatWidget` | `name`, `persona`, `avatar` | Hospital: "Patient assistant" |
| `EntityList` | `entityType`, `fields[]`, `filters[]` | All: "Flight list", "Account list" |
| `EntityDetail` | `entityType`, `fields[]`, `actions[]` | All: "Flight detail", "Account detail" |
| `EntityMap` | `entityType`, `locationField` | Airport: "Gate map", Hospital: "Bed map" |
| `EntityAnalytics` | `entityType`, `kpis[]`, `charts[]` | All: "Analytics dashboard" |

### Component Config Example

```json
{
  "type": "entity-list",
  "entityType": "flight",
  "fields": [
    { "key": "flightNumber", "label": "Flight" },
    { "key": "destination", "label": "Destination" },
    { "key": "departureTime", "label": "Departure" },
    { "key": "status", "label": "Status" }
  ],
  "filters": [
    { "key": "status", "label": "Filter by Status", "options": ["On Time", "Delayed", "Cancelled"] }
  ],
  "actions": [
    { "key": "viewDetail", "label": "View Details" },
    { "key": "checkIn", "label": "Check In" }
  ]
}
```

---

## Appendix D: Demo Flow Examples

### Airport Demo Flow

1. **User arrives at airport website** — Reskinned with airport branding
2. **User views flight list** — Generic `EntityList` component, configured for "flight" entity
3. **User clicks "Book Flight"** — Generic `EntityDetail` component, with "Book" action
4. **User fills out booking form** — Generic form, configured for "booking" entity
5. **User completes booking** — Entity created, Dynatrace trace captured
6. **Presenter shows trace in Dynatrace** — Demonstrates observability
7. **Presenter switches to bank industry** — Changes config, refreshes
8. **User views transaction list** — Same `EntityList` component, configured for "transaction" entity
9. **User clicks "View Details"** — Same `EntityDetail` component
10. **Presenter shows trace in Dynatrace** — Same flow, different context

### Key Insight

The **same components** are used for both industries. Only the **config** changes. This is the "generic" promise fulfilled.

---

**End of Report**

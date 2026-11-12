# Modernization Tracker: Migration to Fully Configurable Platform

This document tracks the progress of migrating Meridian City from hard-coded industry logic to a fully generic, reskinnable platform. 

**The North Star:** Zero code changes required to reskin the application for any industry. All branding, terminology, screens, and data must be driven by the industry configuration.

## 🔴 Remaining Gaps (Audit Findings)

### 1. Frontend: Component Hardcoding
The `PageComposer` is active, but components still rely on hardcoded "Meridian" defaults.
- [ ] **WeatherWidget**: Temperatures and conditions are hardcoded constants.
- [ ] **NewsTicker**: Brand ("Meridian News") and styling are hardcoded; relies on a massive internal `DEFAULT_HEADLINES` list.
- [ ] **TransitPanel**: Topology (coordinates, colors, modes) is hardcoded in `DEFAULT_ROUTES`. Major blocker for non-transport reskins.
- [ ] **ChatWidget**: Greeting and identity fall back to hardcoded "Meri" and "Meridian City" strings.
- [ ] **Login Pages**: Hardcoded "Demo operator" credentials displayed in UI.

### 2. Backend: Logic and Data Hardcoding
- [ ] **Notification Service**: SQL injection vulnerability in `messages.js` (`LIMIT ${lim}`).
- [ ] **Entity Engine**: Some entities are partially hardcoded in Java services instead of being fully schema-driven.
- [ ] **Simulation Logic**: `traffic-bot` and `iot-simulator` use industry-specific logic (flights/gates) rather than generic entity movements.

### 3. Platform: Configuration & Tooling
- [ ] **Config Validation**: Schema exists but is not enforced during the `deploy.sh` process.
- [ ] **Demo Orchestration**: Transitioning industries currently requires a full redeploy.

---

## 🗺️ Execution Plan

### Phase 1: UI "Zero-Hardcode" (Immediate)
**Goal:** Ensure every pixel is derived from config.
- [ ] **Parameterize Widgets**: Update `WeatherWidget`, `NewsTicker`, and `ChatWidget` to strictly use config props.
- [ ] **Genericize Transit**: Transform `TransitPanel` into a generic `NetworkMap` taking topology from config.
- [ ] **Clean Login UI**: Move demo credentials from UI text to a configurable `demo_hints` block.

### Phase 2: Backend Hardening & Genericization (Short-term)
**Goal:** Remove jargon and vulnerabilities from services.
- [ ] **Fix SQLi**: Parameterize the `limit` query in `notification-service`.
- [ ] **Abstract Simulation**: Refactor `traffic-bot` to use Generic Entity Engine transition logic.
- [ ] **Full Entity Migration**: Remove all `if (industry == '...')` logic from Java services.

### Phase 3: Platform Polish (Medium-term)
**Goal:** Make the reskinning process robust and professional.
- [ ] **Deploy-time Validation**: Integrate JSON schema validation into `scripts/deploy.sh`.
- [ ] **Industry Template Library**: Create "Gold Standard" configs for Airport, Bank, and Hospital.

### Final Step: Cleanup
- [ ] **Clean up documentation**: Circle back to fix all repo docs and remove redundant checklists/reports once the migration is complete.

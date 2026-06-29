package com.meridian.citizen.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Runtime fault-injection state for citizen-service, toggled at runtime via
 * POST /admin/fault (see {@link com.meridian.citizen.web.AdminController}) by
 * demo-control-api / the ops-dashboard Demo Control panel.
 *
 * <p>Mirrors the analytics-service / ai-service fault pattern. The db-slowdown
 * delay is applied immediately before the service-request DB write
 * ({@link com.meridian.citizen.service.ServiceRequestService}) so it surfaces as
 * a slow DB span in the api-gateway → citizen-service → service-dispatch →
 * city-operations distributed trace — the intended "Davis AI / DB slowdown" demo.
 */
@Component
public class FaultState {

    private static final Logger log = LoggerFactory.getLogger(FaultState.class);

    private volatile boolean dbSlowdownEnabled = false;
    private volatile double dbSlowdownSeconds = 0.0;

    // Business-exception toggles (default off). Gated, demo-only error branches that
    // make the Dynatrace Business Flows show process failures + conversion drop-off:
    //   request-reject  -> service_request.rejected at validation (ServiceRequestService)
    //   account-fail    -> account.verification_failed / account.activation_failed
    //                      (AccountLifecycleScheduler)
    private volatile boolean requestRejectEnabled = false;
    private volatile double requestRejectRate = 0.0;
    private volatile boolean accountFailEnabled = false;
    private volatile double accountFailRate = 0.0;

    public boolean isDbSlowdownEnabled() {
        return dbSlowdownEnabled;
    }

    public double getDbSlowdownSeconds() {
        return dbSlowdownSeconds;
    }

    public void setDbSlowdown(boolean enabled, double seconds) {
        this.dbSlowdownEnabled = enabled;
        this.dbSlowdownSeconds = seconds;
    }

    public boolean isRequestRejectEnabled() {
        return requestRejectEnabled;
    }

    public double getRequestRejectRate() {
        return requestRejectRate;
    }

    public void setRequestReject(boolean enabled, double rate) {
        this.requestRejectEnabled = enabled;
        this.requestRejectRate = rate;
    }

    public boolean isAccountFailEnabled() {
        return accountFailEnabled;
    }

    public double getAccountFailRate() {
        return accountFailRate;
    }

    public void setAccountFail(boolean enabled, double rate) {
        this.accountFailEnabled = enabled;
        this.accountFailRate = rate;
    }

    /**
     * Sleep for the configured slowdown if the fault is active. Called before DB
     * writes so the latency is attributed to the database operation in traces.
     */
    public void maybeDelay() {
        if (dbSlowdownEnabled && dbSlowdownSeconds > 0) {
            long ms = (long) (dbSlowdownSeconds * 1000);
            log.warn("DB slowdown fault active — sleeping {}ms before DB write", ms);
            try {
                Thread.sleep(ms);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }
    }
}

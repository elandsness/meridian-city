package com.meridian.journey.config;

import org.springframework.stereotype.Component;

/**
 * Runtime fault-injection state for journey-service, toggled via POST /admin/fault
 * (see {@link com.meridian.journey.web.AdminController}) by demo-control-api / the
 * ops-dashboard Demo Control panel.
 *
 * <p>Fault mode: failures_enabled + failure_stage + failure_rate. When on, a share of
 * journeys at the configured stage fail (e.g., cancelled at boarding, offloaded at
 * security). Default off.
 */
@Component
public class FaultState {

    private volatile boolean failuresEnabled = false;
    private volatile String failureStage = null;
    private volatile double failureRate = 0.0;

    public boolean isFailuresEnabled() {
        return failuresEnabled;
    }

    public String getFailureStage() {
        return failureStage;
    }

    public double getFailureRate() {
        return failureRate;
    }

    public void setFailuresEnabled(boolean enabled) {
        this.failuresEnabled = enabled;
    }

    public void setFailureStage(String stage) {
        this.failureStage = stage;
    }

    public void setFailureRate(double rate) {
        this.failureRate = rate;
    }
}

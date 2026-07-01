package com.meridian.passenger.config;

import org.springframework.stereotype.Component;

/**
 * Runtime fault-injection state for passenger-service, toggled via POST /admin/fault by
 * demo-control-api (the unified "Business Failures" control). When enabled, a share of
 * passengers are offloaded at security (see
 * {@link com.meridian.passenger.service.PassengerJourneyScheduler}), emitting
 * passenger.offloaded so the Passenger Journey business flow shows a failure branch +
 * conversion drop-off. Off by default so it never pollutes the happy-path funnel.
 */
@Component
public class FaultState {

    private volatile boolean failuresEnabled = false;
    private volatile double failureRate = 0.0;

    public boolean isFailuresEnabled() {
        return failuresEnabled;
    }

    public double getFailureRate() {
        return failureRate;
    }

    public void setFailures(boolean enabled, double rate) {
        this.failuresEnabled = enabled;
        this.failureRate = rate;
    }
}

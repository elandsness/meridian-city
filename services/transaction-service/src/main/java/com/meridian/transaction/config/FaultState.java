package com.meridian.transaction.config;

import org.springframework.stereotype.Component;

/**
 * Runtime fault-injection state for transaction-service, toggled via POST /admin/fault
 * (see {@link com.meridian.transaction.web.AdminController}) by demo-control-api / the
 * ops-dashboard Demo Control panel.
 *
 * <p>Two fault modes:
 * <ul>
 *   <li>db-slowdown: adds latency to checkout (default off)</li>
 *   <li>payment-fail: fails a share of bill payments at the gateway (default off)</li>
 * </ul>
 * Both are gated demo-only error branches.
 */
@Component
public class FaultState {

    private volatile boolean dbSlowdownEnabled = false;
    private volatile int dbSlowdownDelayMs = 0;
    private volatile boolean paymentFailEnabled = false;
    private volatile double paymentFailRate = 0.0;

    public boolean isDbSlowdownEnabled() {
        return dbSlowdownEnabled;
    }

    public int getDbSlowdownDelayMs() {
        return dbSlowdownDelayMs;
    }

    public void setDbSlowdown(boolean enabled, int delayMs) {
        this.dbSlowdownEnabled = enabled;
        this.dbSlowdownDelayMs = delayMs;
    }

    public boolean isPaymentFailEnabled() {
        return paymentFailEnabled;
    }

    public double getPaymentFailRate() {
        return paymentFailRate;
    }

    public void setPaymentFail(boolean enabled, double rate) {
        this.paymentFailEnabled = enabled;
        this.paymentFailRate = rate;
    }
}

package com.meridian.billing.config;

import org.springframework.stereotype.Component;

/**
 * Runtime fault-injection state for billing-service, toggled via POST /admin/fault
 * (see {@link com.meridian.billing.web.AdminController}) by demo-control-api / the
 * ops-dashboard Demo Control panel.
 *
 * <p>Mirrors the citizen-service fault pattern. The payment-fail toggle (default off)
 * is a gated demo-only error branch: when on, a share of tax-bill payments fail at the
 * gateway ({@link com.meridian.billing.service.BillService}), emitting tax.payment_failed
 * so the "[Meridian] Tax Payment" business flow shows a process failure + drop-off at the
 * Payment step. Off by default so it never pollutes the happy-path funnel.
 */
@Component
public class FaultState {

    private volatile boolean paymentFailEnabled = false;
    private volatile double paymentFailRate = 0.0;

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

package com.meridian.commerce.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Mutable fault-injection configuration (db-slowdown on checkout writes).
 * Bound from application.yml at startup, updated at runtime by AdminController.
 */
@Component
@ConfigurationProperties(prefix = "fault")
@Data
public class FaultInjectionConfig {

    private DbSlowdown dbSlowdown = new DbSlowdown();
    private PaymentDecline paymentDecline = new PaymentDecline();
    private DeliveryFailure deliveryFailure = new DeliveryFailure();

    @Data
    public static class DbSlowdown {
        private boolean enabled = false;
        private long delayMs = 0;
    }

    /**
     * Business-exception toggle (default off): decline a share of checkouts, so the City
     * Store Purchase flow shows a checkout.payment_declined error branch + drop-off at the
     * Checkout step.
     */
    @Data
    public static class PaymentDecline {
        private boolean enabled = false;
        private double rate = 0.0;
    }

    /**
     * Business-exception toggle (default off): fail delivery on a share of shipped orders,
     * surfacing an order.delivery_failed error branch + drop-off at the Delivered step.
     */
    @Data
    public static class DeliveryFailure {
        private boolean enabled = false;
        private double rate = 0.0;
    }
}

package com.meridian.commerce.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.concurrent.ThreadLocalRandom;

/**
 * Per-transition delay bands for the simulated order lifecycle (placed -> packed -> shipped
 * -> delivered). Each band draws a uniform random delay in [min, max] seconds (default
 * ~5 min – 2 hr) so the order.packed/shipped/delivered bizevent steps look realistic instead
 * of firing at fixed 20/30/40 s. cart -> checkout stays bot-driven.
 */
@Component
@ConfigurationProperties(prefix = "fulfillment")
@Data
public class FulfillmentProperties {

    // placed -> packed
    private long packedMinSeconds = 300;
    private long packedMaxSeconds = 7200;

    // packed -> shipped
    private long shippedMinSeconds = 300;
    private long shippedMaxSeconds = 7200;

    // shipped -> delivered
    private long deliveredMinSeconds = 300;
    private long deliveredMaxSeconds = 7200;

    public long nextPackedDelaySeconds() {
        return randomInRange(packedMinSeconds, packedMaxSeconds);
    }

    public long nextShippedDelaySeconds() {
        return randomInRange(shippedMinSeconds, shippedMaxSeconds);
    }

    public long nextDeliveredDelaySeconds() {
        return randomInRange(deliveredMinSeconds, deliveredMaxSeconds);
    }

    /** Uniform random delay in [min, max] seconds (the per-transition jitter). */
    private static long randomInRange(long min, long max) {
        if (max <= min) {
            return Math.max(0L, min);
        }
        return ThreadLocalRandom.current().nextLong(min, max + 1);
    }
}

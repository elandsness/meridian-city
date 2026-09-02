package com.meridian.transaction.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Knobs for the fulfillment delay bands (placed -> packed -> shipped -> delivered).
 * Each transition draws a uniform random delay in its [min, max] band.
 */
@Component
@ConfigurationProperties(prefix = "fulfillment")
@Data
public class FulfillmentProperties {

    private int packedMinSeconds = 300;
    private int packedMaxSeconds = 7200;
    private int shippedMinSeconds = 300;
    private int shippedMaxSeconds = 7200;
    private int deliveredMinSeconds = 300;
    private int deliveredMaxSeconds = 7200;

    /** Convenience: random delay in [packedMinSeconds, packedMaxSeconds]. */
    public int nextPackedDelaySeconds() {
        return packedMinSeconds + (int) (Math.random() * (packedMaxSeconds - packedMinSeconds + 1));
    }
}

package com.meridian.billing.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Knobs for the quarterly tax-bill issuance job
 * ({@link com.meridian.billing.service.QuarterlyBillScheduler}).
 */
@Component
@ConfigurationProperties(prefix = "billing.quarterly")
@Data
public class QuarterlyBillProperties {

    /** Master switch for the quarterly issuance job. */
    private boolean enabled = true;

    /** Inclusive lower bound for a generated bill amount (cents). */
    private int minAmountCents = 15000;

    /** Inclusive upper bound for a generated bill amount (cents). */
    private int maxAmountCents = 45000;

    /** Days from issue to due date. */
    private int dueDays = 45;
}

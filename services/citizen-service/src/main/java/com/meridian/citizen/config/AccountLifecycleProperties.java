package com.meridian.citizen.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Completion odds for the simulated account-creation lifecycle emitted by
 * CitizenService. A share of accounts intentionally never verify/activate so the
 * account-creation funnel shows a realistic drop-off.
 */
@Component
@ConfigurationProperties(prefix = "account-lifecycle")
@Data
public class AccountLifecycleProperties {

    /** Master switch for emitting the account-creation lifecycle. */
    private boolean enabled = true;

    /** Probability (0..1) that a registered account reaches "verified". */
    private double verifyProbability = 0.85;

    /** Probability (0..1) that a verified account reaches "activated". */
    private double activateProbability = 0.92;
}

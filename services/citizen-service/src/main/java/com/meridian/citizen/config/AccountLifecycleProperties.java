package com.meridian.citizen.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.concurrent.ThreadLocalRandom;

/**
 * Delay bands + completion odds for the simulated account-creation lifecycle. The signup
 * burst (registration_started -> details_submitted -> verification_sent) is emitted
 * synchronously at registration; verified and activated are deferred by the bands below
 * (uniform random delay in [min, max] seconds, default ~5 min – 2 hr) so the funnel shows
 * realistic gaps instead of all 5 stages landing within ~2 ms. A share of accounts never
 * verify/activate (the probabilities) so the funnel keeps a realistic drop-off.
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

    // verification_sent -> verified
    private long verifiedMinSeconds = 300;
    private long verifiedMaxSeconds = 7200;

    // verified -> activated
    private long activatedMinSeconds = 300;
    private long activatedMaxSeconds = 7200;

    public long nextVerifiedDelaySeconds() {
        return randomInRange(verifiedMinSeconds, verifiedMaxSeconds);
    }

    public long nextActivatedDelaySeconds() {
        return randomInRange(activatedMinSeconds, activatedMaxSeconds);
    }

    /** Uniform random delay in [min, max] seconds (the per-transition jitter). */
    private static long randomInRange(long min, long max) {
        if (max <= min) {
            return Math.max(0L, min);
        }
        return ThreadLocalRandom.current().nextLong(min, max + 1);
    }
}

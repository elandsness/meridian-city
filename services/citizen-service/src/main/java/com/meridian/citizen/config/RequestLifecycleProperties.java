package com.meridian.citizen.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.concurrent.ThreadLocalRandom;

/**
 * Per-transition delay bands + completion odds for the simulated service-request
 * lifecycle. citizen-service is the timeline owner for the whole Service Request
 * business flow (submitted -> validated -> dispatched -> assigned -> in_progress ->
 * resolved): it computes the full schedule at submit time and hands service-dispatch
 * the absolute dispatched/assigned target timestamps, so every step lands in a
 * realistic, randomized, strictly-increasing order.
 *
 * <p>Each transition draws a uniform random delay in [min, max] seconds (defaulting
 * to the ~5 min – 2 hr band) so consecutive bizevent steps no longer fire microseconds
 * apart. Tune any band down via the matching {@code REQUEST_LIFECYCLE_*} env vars for
 * a live demo. {@link #completionProbability} keeps the funnel drop-off intact.
 */
@Component
@ConfigurationProperties(prefix = "request-lifecycle")
@Data
public class RequestLifecycleProperties {

    /** Master switch for the background lifecycle scheduler. */
    private boolean enabled = true;

    // submitted -> validated
    private long validatedMinSeconds = 300;
    private long validatedMaxSeconds = 7200;

    // validated -> dispatched (emitted by service-dispatch at this absolute target)
    private long dispatchedMinSeconds = 300;
    private long dispatchedMaxSeconds = 7200;

    // dispatched -> assigned (emitted by service-dispatch at this absolute target)
    private long assignedMinSeconds = 300;
    private long assignedMaxSeconds = 7200;

    // assigned -> in_progress
    private long inProgressMinSeconds = 300;
    private long inProgressMaxSeconds = 7200;

    // in_progress -> resolved
    private long resolvedMinSeconds = 300;
    private long resolvedMaxSeconds = 7200;

    /**
     * Probability (0..1) that an in_progress request resolves rather than being
     * left intentionally incomplete — gives the funnel a realistic drop-off to
     * investigate in Dynatrace.
     */
    private double completionProbability = 0.88;

    public long nextValidatedDelaySeconds() {
        return randomInRange(validatedMinSeconds, validatedMaxSeconds);
    }

    public long nextDispatchedDelaySeconds() {
        return randomInRange(dispatchedMinSeconds, dispatchedMaxSeconds);
    }

    public long nextAssignedDelaySeconds() {
        return randomInRange(assignedMinSeconds, assignedMaxSeconds);
    }

    public long nextInProgressDelaySeconds() {
        return randomInRange(inProgressMinSeconds, inProgressMaxSeconds);
    }

    public long nextResolvedDelaySeconds() {
        return randomInRange(resolvedMinSeconds, resolvedMaxSeconds);
    }

    /** Uniform random delay in [min, max] seconds (the per-transition jitter). */
    private static long randomInRange(long min, long max) {
        if (max <= min) {
            return Math.max(0L, min);
        }
        return ThreadLocalRandom.current().nextLong(min, max + 1);
    }
}

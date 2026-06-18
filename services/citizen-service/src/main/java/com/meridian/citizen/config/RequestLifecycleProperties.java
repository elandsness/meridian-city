package com.meridian.citizen.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Timer offsets + completion odds for the simulated service-request lifecycle,
 * driven by {@link com.meridian.citizen.service.RequestLifecycleScheduler}.
 */
@Component
@ConfigurationProperties(prefix = "request-lifecycle")
@Data
public class RequestLifecycleProperties {

    /** Master switch for the background lifecycle scheduler. */
    private boolean enabled = true;

    /** Seconds after submission before a request advances to in_progress. */
    private long inProgressAfterSeconds = 20;

    /** Seconds in in_progress before a request resolves. */
    private long resolvedAfterSeconds = 40;

    /**
     * Probability (0..1) that an in_progress request resolves rather than being
     * left intentionally incomplete — gives the funnel a realistic drop-off to
     * investigate in Dynatrace.
     */
    private double completionProbability = 0.88;
}

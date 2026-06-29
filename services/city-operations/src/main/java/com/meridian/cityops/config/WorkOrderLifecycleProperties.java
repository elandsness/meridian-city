package com.meridian.cityops.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.concurrent.ThreadLocalRandom;

/**
 * Per-transition delay bands + completion odds for the simulated IoT Incident flow, driven by
 * {@link com.meridian.cityops.service.WorkOrderLifecycleScheduler}.
 *
 * <p>The anomaly is detected synchronously, then the incident.created and workorder.created
 * business events are deferred (incidentCreated / workorderCreated bands) and the work-order
 * lifecycle (assigned -> acknowledged -> resolved) runs in-band — so the six bizevent steps no
 * longer fire microseconds apart. Each band draws a uniform random delay in [min, max] seconds
 * (default ~5 min – 2 hr). {@link #completionProbability} keeps the funnel drop-off.
 */
@Component
@ConfigurationProperties(prefix = "workorder-lifecycle")
@Data
public class WorkOrderLifecycleProperties {

    /** Master switch for the background work-order scheduler. */
    private boolean enabled = true;

    // anomaly_detected -> incident.created (deferred event emission)
    private long incidentCreatedMinSeconds = 300;
    private long incidentCreatedMaxSeconds = 7200;

    // incident.created -> workorder.created (deferred event emission)
    private long workorderCreatedMinSeconds = 300;
    private long workorderCreatedMaxSeconds = 7200;

    // workorder.created -> assigned
    private long assignedMinSeconds = 300;
    private long assignedMaxSeconds = 7200;

    // assigned -> acknowledged
    private long acknowledgedMinSeconds = 300;
    private long acknowledgedMaxSeconds = 7200;

    // acknowledged -> resolved
    private long resolvedMinSeconds = 300;
    private long resolvedMaxSeconds = 7200;

    /**
     * Probability (0..1) that an acknowledged work order resolves rather than being
     * left intentionally incomplete — gives the iot-incident funnel a realistic drop-off.
     */
    private double completionProbability = 0.85;

    public long nextIncidentCreatedDelaySeconds() {
        return randomInRange(incidentCreatedMinSeconds, incidentCreatedMaxSeconds);
    }

    public long nextWorkorderCreatedDelaySeconds() {
        return randomInRange(workorderCreatedMinSeconds, workorderCreatedMaxSeconds);
    }

    public long nextAssignedDelaySeconds() {
        return randomInRange(assignedMinSeconds, assignedMaxSeconds);
    }

    public long nextAcknowledgedDelaySeconds() {
        return randomInRange(acknowledgedMinSeconds, acknowledgedMaxSeconds);
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

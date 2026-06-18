package com.meridian.cityops.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Timer offsets + completion odds for the simulated work-order lifecycle, driven by
 * {@link com.meridian.cityops.service.WorkOrderLifecycleScheduler}.
 */
@Component
@ConfigurationProperties(prefix = "workorder-lifecycle")
@Data
public class WorkOrderLifecycleProperties {

    /** Master switch for the background work-order scheduler. */
    private boolean enabled = true;

    /** Seconds after creation before a work order is assigned. */
    private long assignedAfterSeconds = 15;

    /** Seconds after assignment before a work order is acknowledged. */
    private long acknowledgedAfterSeconds = 20;

    /** Seconds after acknowledgement before a work order resolves. */
    private long resolvedAfterSeconds = 30;

    /**
     * Probability (0..1) that an acknowledged work order resolves rather than being
     * left intentionally incomplete — gives the iot-incident funnel a realistic drop-off.
     */
    private double completionProbability = 0.85;
}

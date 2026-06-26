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
    private long assignedAfterSeconds = 60;

    /** Seconds after assignment before a work order is acknowledged. */
    private long acknowledgedAfterSeconds = 120;

    /**
     * Seconds after acknowledgement before a work order resolves. Kept on the
     * order of minutes (total ~6 min) so IoT incidents stay open long enough to
     * be visible on the Incidents page and overlap with the live device anomaly
     * on the Fleet page, instead of resolving before anyone refreshes.
     */
    private long resolvedAfterSeconds = 180;

    /**
     * Probability (0..1) that an acknowledged work order resolves rather than being
     * left intentionally incomplete — gives the iot-incident funnel a realistic drop-off.
     */
    private double completionProbability = 0.85;
}

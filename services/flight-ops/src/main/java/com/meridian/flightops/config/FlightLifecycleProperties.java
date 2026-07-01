package com.meridian.flightops.config;

import java.util.concurrent.ThreadLocalRandom;
import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Timing for the simulated flight lifecycle, driven by
 * {@link com.meridian.flightops.service.FlightLifecycleScheduler}.
 *
 * <p>Each status transition (at_gate → servicing → boarding → taxiing → takeoff for
 * departures; approach → landing → taxi_in → at_gate for arrivals) is spaced by a
 * uniform random delay in [minSeconds, maxSeconds], so the aircraft-turnaround
 * Business Flow steps don't fire microseconds apart. Kept short by default for a
 * lively demo; override via env (FLIGHT_LIFECYCLE_*).
 */
@Component
@ConfigurationProperties(prefix = "flight-lifecycle")
@Data
public class FlightLifecycleProperties {

    /** Master switch for the background flight scheduler. */
    private boolean enabled = true;

    private long minSeconds = 20;
    private long maxSeconds = 120;

    /** Uniform random delay in [min, max] seconds for the next transition. */
    public long nextDelaySeconds() {
        if (maxSeconds <= minSeconds) {
            return Math.max(0L, minSeconds);
        }
        return ThreadLocalRandom.current().nextLong(minSeconds, maxSeconds + 1);
    }
}

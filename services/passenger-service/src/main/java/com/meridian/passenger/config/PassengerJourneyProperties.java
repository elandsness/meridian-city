package com.meridian.passenger.config;

import java.util.concurrent.ThreadLocalRandom;
import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Timing for the simulated passenger journey, driven by
 * {@link com.meridian.passenger.service.PassengerJourneyScheduler}. Each step
 * (check_in → [bag_check] → security_cleared → [bag_loaded] → boarded) is spaced by
 * a uniform random delay in [minSeconds, maxSeconds].
 */
@Component
@ConfigurationProperties(prefix = "passenger-journey")
@Data
public class PassengerJourneyProperties {

    private boolean enabled = true;
    private long minSeconds = 20;
    private long maxSeconds = 120;

    public long nextDelaySeconds() {
        if (maxSeconds <= minSeconds) {
            return Math.max(0L, minSeconds);
        }
        return ThreadLocalRandom.current().nextLong(minSeconds, maxSeconds + 1);
    }
}

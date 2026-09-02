package com.meridian.journey.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Knobs for the journey lifecycle scheduler.
 */
@Component
@ConfigurationProperties(prefix = "journey.lifecycle")
@Data
public class JourneyLifecycleProperties {

    private boolean enabled = true;
    private int minSeconds = 300;
    private int maxSeconds = 7200;
    private Map<String, String> transitions;
    private Map<String, Double> progressMap;
    private List<String> activeStatuses;

    /** Convenience: random delay in [minSeconds, maxSeconds]. */
    public int nextDelaySeconds() {
        return minSeconds + ThreadLocalRandom.current().nextInt(Math.max(1, maxSeconds - minSeconds + 1));
    }

    /** Get the next status for a given current status, or null if terminal. */
    public String getNextStatus(String currentStatus) {
        return transitions.get(currentStatus);
    }

    /** Get the progress for a given status. */
    public double progressFor(String status) {
        return progressMap.getOrDefault(status, 0.0);
    }
}

package com.meridian.journey.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.concurrent.ThreadLocalRandom;

@Component
@ConfigurationProperties(prefix = "journey.lifecycle")
@Data
public class JourneyLifecycleProperties {

    private boolean enabled = true;
    private int minSeconds = 300;
    private int maxSeconds = 7200;
    
    // Maps current status -> next status
    private Map<String, String> transitions = new HashMap<>();
    // Maps status -> progress (0.0 to 1.0)
    private Map<String, Double> progressMap = new HashMap<>();
    private List<String> activeStatuses = new ArrayList<>();

    public int nextDelaySeconds() {
        return minSeconds + ThreadLocalRandom.current().nextInt(Math.max(1, maxSeconds - minSeconds + 1));
    }

    public String getNextStatus(String currentStatus) {
        return transitions.get(currentStatus);
    }

    public double progressFor(String status) {
        return progressMap.getOrDefault(status, 0.0);
    }
}

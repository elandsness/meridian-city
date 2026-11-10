package com.meridian.journey.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.concurrent.ThreadLocalRandom;

@Component
@ConfigurationProperties(prefix = "journey.lifecycle")
public class JourneyLifecycleProperties {

    private boolean enabled = true;
    private int minSeconds = 300;
    private int maxSeconds = 7200;
    
    private Map<String, String> transitions = new HashMap<>();
    private Map<String, Double> progressMap = new HashMap<>();
    private List<String> activeStatuses = new ArrayList<>();
    private String primaryJourneyEntityType = "passenger";

    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }

    public int getMinSeconds() { return minSeconds; }
    public void setMinSeconds(int minSeconds) { this.minSeconds = minSeconds; }

    public int getMaxSeconds() { return maxSeconds; }
    public void setMaxSeconds(int maxSeconds) { this.maxSeconds = maxSeconds; }

    public Map<String, String> getTransitions() { return transitions; }
    public void setTransitions(Map<String, String> transitions) { this.transitions = transitions; }

    public Map<String, Double> getProgressMap() { return progressMap; }
    public void setProgressMap(Map<String, Double> progressMap) { this.progressMap = progressMap; }

    public List<String> getActiveStatuses() { return activeStatuses; }
    public void setActiveStatuses(List<String> activeStatuses) { this.activeStatuses = activeStatuses; }

    public String getPrimaryJourneyEntityType() { return primaryJourneyEntityType; }
    public void setPrimaryJourneyEntityType(String primaryJourneyEntityType) { this.primaryJourneyEntityType = primaryJourneyEntityType; }

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

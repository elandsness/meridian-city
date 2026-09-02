package com.meridian.journey.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * Knobs for the journey generator.
 */
@Component
@ConfigurationProperties(prefix = "generator")
@Data
public class JourneyGeneratorProperties {

    private boolean enabled = true;
    private int maxActive = 24;
    private int passengerMaxActive = 60;
    private double bagProbability = 0.7;
    private String[] entityTypes = {"flight", "passenger"};
    private Map<String, String> initialStatuses;
}

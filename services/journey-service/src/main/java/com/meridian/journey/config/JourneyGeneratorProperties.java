package com.meridian.journey.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.List;
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

    /**
     * Named routes with map coordinates, for any entity type not hardcoded in
     * JourneyGenerator's switch (i.e. anything other than "flight"/"passenger").
     * A generated journey for such a type picks a random route from this list, so
     * a new industry gets a moving map purely from config -- no code change.
     * Coordinates are in the industry config's map viewBox space (see
     * Journey#originX), not lat/lng.
     */
    private List<RouteConfig> routes = List.of();

    @Data
    public static class RouteConfig {
        private String origin;
        private String destination;
        private double originX;
        private double originY;
        private double destX;
        private double destY;
    }
}

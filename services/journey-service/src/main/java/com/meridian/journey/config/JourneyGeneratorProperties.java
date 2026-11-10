package com.meridian.journey.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

@Component
@ConfigurationProperties(prefix = "generator")
public class JourneyGeneratorProperties {

    private boolean enabled = true;
    private int maxActive = 24;
    private int passengerMaxActive = 60;
    private double bagProbability = 0.7;
    private String[] entityTypes = {"flight", "passenger"};
    private Map<String, String> initialStatuses;
    private List<RouteConfig> routes = List.of();

    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }

    public int getMaxActive() { return maxActive; }
    public void setMaxActive(int maxActive) { this.maxActive = maxActive; }

    public int getPassengerMaxActive() { return passengerMaxActive; }
    public void setPassengerMaxActive(int passengerMaxActive) { this.passengerMaxActive = passengerMaxActive; }

    public double getBagProbability() { return bagProbability; }
    public void setBagProbability(double bagProbability) { this.bagProbability = bagProbability; }

    public String[] getEntityTypes() { return entityTypes; }
    public void setEntityTypes(String[] entityTypes) { this.entityTypes = entityTypes; }

    public Map<String, String> getInitialStatuses() { return initialStatuses; }
    public void setInitialStatuses(Map<String, String> initialStatuses) { this.initialStatuses = initialStatuses; }

    public List<RouteConfig> getRoutes() { return routes; }
    public void setRoutes(List<RouteConfig> routes) { this.routes = routes; }

    public static class RouteConfig {
        private String origin;
        private String destination;
        private double originX;
        private double originY;
        private double destX;
        private double destY;

        public String getOrigin() { return origin; }
        public void setOrigin(String origin) { this.origin = origin; }

        public String getDestination() { return destination; }
        public void setDestination(String destination) { this.destination = destination; }

        public double getOriginX() { return originX; }
        public void setOriginX(double originX) { this.originX = originX; }

        public double getOriginY() { return originY; }
        public void setOriginY(double originY) { this.originY = originY; }

        public double getDestX() { return destX; }
        public void setDestX(double destX) { this.destX = destX; }

        public double getDestY() { return destY; }
        public void setDestY(double destY) { this.destY = destY; }
    }
}

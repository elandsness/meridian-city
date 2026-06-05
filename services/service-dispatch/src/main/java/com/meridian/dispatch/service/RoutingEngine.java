package com.meridian.dispatch.service;

import org.springframework.stereotype.Component;

@Component
public class RoutingEngine {

    public String assignDepartment(String category) {
        if (category == null) {
            return "General Services";
        }
        return switch (category.toLowerCase()) {
            case "infrastructure" -> "Infrastructure Maintenance";
            case "utilities"      -> "Utilities Operations";
            case "parks"          -> "Parks and Recreation";
            case "permits"        -> "Permits Office";
            case "sanitation"     -> "Sanitation Services";
            case "transport"      -> "Transportation Department";
            default               -> "General Services";
        };
    }

    public String buildRoutingReason(String category, String zoneId) {
        String department = assignDepartment(category);
        String categoryLabel = (category != null) ? capitalize(category) : "General";
        String zone = (zoneId != null && !zoneId.isBlank()) ? zoneId : "unknown zone";
        return categoryLabel + " request from " + zone + " routed to " + department;
    }

    private String capitalize(String value) {
        if (value == null || value.isBlank()) {
            return value;
        }
        return Character.toUpperCase(value.charAt(0)) + value.substring(1).toLowerCase();
    }
}

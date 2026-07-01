package com.meridian.dispatch.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Routes a request category to the responsible department. The mapping is
 * industry-configurable: an overlay supplies a JSON {category: department} map via
 * the ROUTING_MAP env (from .Values.industry.routing). When empty/malformed, the
 * built-in City routing below is used, so the default deployment is unchanged.
 */
@Component
public class RoutingEngine {

    private static final String DEFAULT_DEPARTMENT = "General Services";

    // Built-in City routing — the fallback when no ROUTING_MAP is provided.
    private static final Map<String, String> CITY_ROUTING = Map.of(
        "infrastructure", "Infrastructure Maintenance",
        "utilities",      "Utilities Operations",
        "parks",          "Parks and Recreation",
        "permits",        "Permits Office",
        "sanitation",     "Sanitation Services",
        "transport",      "Transportation Department"
    );

    private final Map<String, String> routing;
    private final String defaultDepartment;

    public RoutingEngine(
        @Value("${ROUTING_MAP:}") String routingJson,
        @Value("${ROUTING_DEFAULT_DEPARTMENT:General Services}") String defaultDept
    ) {
        this.defaultDepartment = (defaultDept == null || defaultDept.isBlank())
            ? DEFAULT_DEPARTMENT
            : defaultDept;
        Map<String, String> parsed = parseRouting(routingJson);
        this.routing = parsed.isEmpty() ? lowerKeys(CITY_ROUTING) : parsed;
    }

    public String assignDepartment(String category) {
        if (category == null) {
            return defaultDepartment;
        }
        return routing.getOrDefault(category.toLowerCase(), defaultDepartment);
    }

    public String buildRoutingReason(String category, String zoneId) {
        String department = assignDepartment(category);
        String categoryLabel = (category != null) ? capitalize(category) : "General";
        String zone = (zoneId != null && !zoneId.isBlank()) ? zoneId : "unknown zone";
        return categoryLabel + " request from " + zone + " routed to " + department;
    }

    private static Map<String, String> parseRouting(String json) {
        if (json == null || json.isBlank()) {
            return Collections.emptyMap();
        }
        try {
            @SuppressWarnings("unchecked")
            Map<String, String> raw = new ObjectMapper().readValue(json, Map.class);
            return lowerKeys(raw);
        } catch (Exception e) {
            // Malformed override — fall back to the built-in routing.
            return Collections.emptyMap();
        }
    }

    private static Map<String, String> lowerKeys(Map<String, String> in) {
        Map<String, String> out = new HashMap<>();
        in.forEach((k, v) -> {
            if (k != null && v != null) {
                out.put(k.toLowerCase(), v);
            }
        });
        return out;
    }

    private String capitalize(String value) {
        if (value == null || value.isBlank()) {
            return value;
        }
        return Character.toUpperCase(value.charAt(0)) + value.substring(1).toLowerCase();
    }
}

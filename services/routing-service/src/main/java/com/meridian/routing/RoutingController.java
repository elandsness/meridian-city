package com.meridian.routing;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Stateless (category, zone, priority) -> department decision, called via a
 * service_request entity's callService effect. Request/response bodies are
 * plain snake_case maps (matching every field-value the entity-config already
 * declares, e.g. "category"/"zone_id") rather than typed DTOs, so a new
 * industry's routing needs never requires a code change here.
 */
@RestController
@RequiredArgsConstructor
public class RoutingController {

    private final RoutingEngine routingEngine;

    @PostMapping("/api/v1/route")
    public Map<String, Object> route(@RequestBody(required = false) Map<String, Object> body) {
        String category = body == null ? null : (String) body.get("category");
        String zoneId = body == null ? null : (String) body.get("zone_id");
        return Map.of(
                "department", routingEngine.assignDepartment(category),
                "reason", routingEngine.buildRoutingReason(category, zoneId)
        );
    }
}

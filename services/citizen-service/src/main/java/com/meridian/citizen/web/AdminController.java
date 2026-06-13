package com.meridian.citizen.web;

import com.meridian.citizen.config.FaultState;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Runtime fault-injection control, called by demo-control-api (Demo Control panel).
 *
 * <p>POST /admin/fault body (snake_case via the service-wide Jackson SNAKE_CASE
 * strategy, matching what demo-control-api and analytics-service use):
 * <pre>
 * { "db_slowdown_enabled": true, "db_slowdown_seconds": 2 }
 * </pre>
 * Not under /api/v1, so it is not exposed through the api-gateway.
 */
@RestController
@RequestMapping("/admin")
public class AdminController {

    private final FaultState faultState;

    public AdminController(FaultState faultState) {
        this.faultState = faultState;
    }

    /** db_slowdown_enabled / db_slowdown_seconds bind from snake_case via Jackson. */
    public record FaultRequest(Boolean dbSlowdownEnabled, Double dbSlowdownSeconds) {}

    @PostMapping("/fault")
    public Map<String, Object> setFault(@RequestBody FaultRequest req) {
        boolean enabled = Boolean.TRUE.equals(req.dbSlowdownEnabled());
        // Keep the previously-set duration if the caller omits it (e.g. on disable).
        double seconds = req.dbSlowdownSeconds() != null
                ? req.dbSlowdownSeconds()
                : faultState.getDbSlowdownSeconds();
        faultState.setDbSlowdown(enabled, seconds);

        // Map keys are emitted verbatim (the naming strategy applies to beans, not
        // Map keys), so these are already snake_case.
        return Map.of(
                "ok", true,
                "db_slowdown_enabled", faultState.isDbSlowdownEnabled(),
                "db_slowdown_seconds", faultState.getDbSlowdownSeconds()
        );
    }
}

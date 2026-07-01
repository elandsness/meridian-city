package com.meridian.flightops.web;

import com.meridian.flightops.config.FaultState;
import java.util.Map;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Runtime fault-injection control, called by demo-control-api (the unified Business
 * Failures control). Standard contract shared by the newer services:
 * <pre>POST /admin/fault { "failures_enabled": true, "failure_rate": 0.3 }</pre>
 * The rate is kept if omitted (e.g. on disable). Not under /api/v1, so not exposed
 * through the api-gateway.
 */
@RestController
@RequestMapping("/admin")
public class AdminController {

    private final FaultState faultState;

    public AdminController(FaultState faultState) {
        this.faultState = faultState;
    }

    /** failures_enabled / failure_rate bind from snake_case via Jackson. */
    public record FaultRequest(Boolean failuresEnabled, Double failureRate) {}

    @PostMapping("/fault")
    public Map<String, Object> setFault(@RequestBody FaultRequest req) {
        if (req.failuresEnabled() != null) {
            double rate = req.failureRate() != null ? req.failureRate() : faultState.getFailureRate();
            faultState.setFailures(req.failuresEnabled(), rate);
        }
        return Map.of(
                "ok", true,
                "failures_enabled", faultState.isFailuresEnabled(),
                "failure_rate", faultState.getFailureRate()
        );
    }
}

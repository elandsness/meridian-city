package com.meridian.journey.web;

import com.meridian.journey.config.FaultState;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Runtime fault-injection control, called by demo-control-api (Demo Control panel).
 *
 * <p>POST /admin/fault body (snake_case via the service-wide Jackson SNAKE_CASE strategy):
 * <pre>
 * { "failures_enabled": true, "failure_stage": "boarding", "failure_rate": 0.3 }
 * </pre>
 */
@RestController
@RequestMapping("/admin")
public class AdminController {

    private final FaultState faultState;

    public AdminController(FaultState faultState) {
        this.faultState = faultState;
    }

    public record FaultRequest(
            Boolean failuresEnabled,
            String failureStage,
            Double failureRate
    ) {}

    @PostMapping("/fault")
    public Map<String, Object> setFault(@RequestBody FaultRequest req) {
        if (req.failuresEnabled() != null) {
            faultState.setFailuresEnabled(req.failuresEnabled());
        }
        if (req.failureStage() != null) {
            faultState.setFailureStage(req.failureStage());
        }
        if (req.failureRate() != null) {
            faultState.setFailureRate(req.failureRate());
        }
        return Map.of(
                "ok", true,
                "failures_enabled", faultState.isFailuresEnabled(),
                "failure_stage", faultState.getFailureStage(),
                "failure_rate", faultState.getFailureRate()
        );
    }
}

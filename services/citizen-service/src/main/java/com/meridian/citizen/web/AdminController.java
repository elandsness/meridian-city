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
 * { "request_reject_enabled": true, "request_reject_rate": 0.3 }
 * { "account_fail_enabled": true,  "account_fail_rate": 0.3 }
 * </pre>
 * Each toggle is independent: a field group is only touched when its {@code *_enabled}
 * flag is present, so demo-control can flip one fault without disturbing the others
 * (e.g. reset-all posts only {@code db_slowdown_enabled:false}).
 * Not under /api/v1, so it is not exposed through the api-gateway.
 */
@RestController
@RequestMapping("/admin")
public class AdminController {

    private final FaultState faultState;

    public AdminController(FaultState faultState) {
        this.faultState = faultState;
    }

    /** All fields bind from snake_case via Jackson; any omitted field is null (left unchanged). */
    public record FaultRequest(Boolean dbSlowdownEnabled, Double dbSlowdownSeconds,
                               Boolean requestRejectEnabled, Double requestRejectRate,
                               Boolean accountFailEnabled, Double accountFailRate) {}

    @PostMapping("/fault")
    public Map<String, Object> setFault(@RequestBody FaultRequest req) {
        if (req.dbSlowdownEnabled() != null) {
            // Keep the previously-set duration if the caller omits it (e.g. on disable).
            double seconds = req.dbSlowdownSeconds() != null
                    ? req.dbSlowdownSeconds()
                    : faultState.getDbSlowdownSeconds();
            faultState.setDbSlowdown(req.dbSlowdownEnabled(), seconds);
        }
        if (req.requestRejectEnabled() != null) {
            double rate = req.requestRejectRate() != null
                    ? req.requestRejectRate()
                    : faultState.getRequestRejectRate();
            faultState.setRequestReject(req.requestRejectEnabled(), rate);
        }
        if (req.accountFailEnabled() != null) {
            double rate = req.accountFailRate() != null
                    ? req.accountFailRate()
                    : faultState.getAccountFailRate();
            faultState.setAccountFail(req.accountFailEnabled(), rate);
        }

        // Map keys are emitted verbatim (the naming strategy applies to beans, not
        // Map keys), so these are already snake_case.
        return Map.of(
                "ok", true,
                "db_slowdown_enabled", faultState.isDbSlowdownEnabled(),
                "db_slowdown_seconds", faultState.getDbSlowdownSeconds(),
                "request_reject_enabled", faultState.isRequestRejectEnabled(),
                "request_reject_rate", faultState.getRequestRejectRate(),
                "account_fail_enabled", faultState.isAccountFailEnabled(),
                "account_fail_rate", faultState.getAccountFailRate()
        );
    }
}

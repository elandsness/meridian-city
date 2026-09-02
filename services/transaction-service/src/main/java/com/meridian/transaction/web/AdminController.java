package com.meridian.transaction.web;

import com.meridian.transaction.config.FaultState;
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
 * { "db_slowdown_enabled": true, "db_slowdown_delay_ms": 500,
 *   "payment_fail_enabled": true, "payment_fail_rate": 0.3 }
 * </pre>
 * The payment_fail_rate is kept if omitted (e.g. on disable). Not under /api/v1,
 * so it is not exposed through the api-gateway.
 */
@RestController
@RequestMapping("/admin")
public class AdminController {

    private final FaultState faultState;

    public AdminController(FaultState faultState) {
        this.faultState = faultState;
    }

    /** db_slowdown_enabled / db_slowdown_delay_ms / payment_fail_enabled / payment_fail_rate bind from snake_case via Jackson. */
    public record FaultRequest(
            Boolean dbSlowdownEnabled,
            Integer dbSlowdownDelayMs,
            Boolean paymentFailEnabled,
            Double paymentFailRate
    ) {}

    @PostMapping("/fault")
    public Map<String, Object> setFault(@RequestBody FaultRequest req) {
        if (req.dbSlowdownEnabled() != null) {
            int delay = req.dbSlowdownDelayMs() != null
                    ? req.dbSlowdownDelayMs()
                    : faultState.getDbSlowdownDelayMs();
            faultState.setDbSlowdown(req.dbSlowdownEnabled(), delay);
        }
        if (req.paymentFailEnabled() != null) {
            double rate = req.paymentFailRate() != null
                    ? req.paymentFailRate()
                    : faultState.getPaymentFailRate();
            faultState.setPaymentFail(req.paymentFailEnabled(), rate);
        }
        // Map keys are emitted verbatim (the naming strategy applies to beans, not Map keys).
        return Map.of(
                "ok", true,
                "db_slowdown_enabled", faultState.isDbSlowdownEnabled(),
                "db_slowdown_delay_ms", faultState.getDbSlowdownDelayMs(),
                "payment_fail_enabled", faultState.isPaymentFailEnabled(),
                "payment_fail_rate", faultState.getPaymentFailRate()
        );
    }
}

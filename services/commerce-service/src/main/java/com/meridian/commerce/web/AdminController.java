package com.meridian.commerce.web;

import com.meridian.commerce.config.FaultInjectionConfig;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

/**
 * Runtime fault injection control (called by demo-control-api).
 * POST /admin/fault body:
 *   { "type": "db-slowdown",       "enabled": true, "delayMs": 2000 }
 *   { "type": "checkout-failures", "enabled": true, "rate": 0.3 }
 * checkout-failures drives both the checkout decline and the delivery failure from one rate.
 */
@RestController
@RequestMapping("/admin")
@RequiredArgsConstructor
@Slf4j
public class AdminController {

    private final FaultInjectionConfig faultConfig;

    @PostMapping("/fault")
    public Map<String, Object> setFault(@RequestBody Map<String, Object> body) {
        String type = String.valueOf(body.getOrDefault("type", ""));
        boolean enabled = Boolean.parseBoolean(String.valueOf(body.getOrDefault("enabled", false)));
        long delayMs = body.containsKey("delayMs") ? Long.parseLong(String.valueOf(body.get("delayMs"))) : 0;
        double rate = body.containsKey("rate")
                ? Double.parseDouble(String.valueOf(body.get("rate")))
                : faultConfig.getPaymentDecline().getRate();

        if ("db-slowdown".equals(type)) {
            faultConfig.getDbSlowdown().setEnabled(enabled);
            faultConfig.getDbSlowdown().setDelayMs(delayMs);
            log.warn("Fault injection updated: db-slowdown enabled={} delayMs={}", enabled, delayMs);
        } else if ("checkout-failures".equals(type)) {
            faultConfig.getPaymentDecline().setEnabled(enabled);
            faultConfig.getPaymentDecline().setRate(rate);
            faultConfig.getDeliveryFailure().setEnabled(enabled);
            faultConfig.getDeliveryFailure().setRate(rate);
            log.warn("Fault injection updated: checkout-failures enabled={} rate={}", enabled, rate);
        } else {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Unknown fault type: " + type + ". Valid values: db-slowdown, checkout-failures");
        }

        return Map.of("applied", true, "type", type, "enabled", enabled);
    }
}

package com.meridian.cityops.web;

import com.meridian.cityops.config.FaultInjectionConfig;
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
 * Admin endpoint for runtime fault injection control.
 * Called by demo-control-api to enable/disable chaos scenarios.
 *
 * <p>POST /admin/fault body:
 * <pre>
 * {
 *   "type": "db-slowdown" | "cpu-spike",
 *   "enabled": true | false,
 *   "delayMs": 2000      (only relevant for db-slowdown)
 * }
 * </pre>
 */
@RestController
@RequestMapping("/admin")
@RequiredArgsConstructor
@Slf4j
public class AdminController {

    private final FaultInjectionConfig faultConfig;

    @PostMapping("/fault")
    public Map<String, Object> setFault(@RequestBody Map<String, Object> body) {
        String type = extractString(body, "type");
        boolean enabled = Boolean.parseBoolean(String.valueOf(body.getOrDefault("enabled", false)));
        int delayMs = body.containsKey("delayMs")
                ? Integer.parseInt(String.valueOf(body.get("delayMs")))
                : 0;

        switch (type) {
            case "db-slowdown" -> {
                faultConfig.getDbSlowdown().setEnabled(enabled);
                faultConfig.getDbSlowdown().setDelayMs(delayMs);
                log.warn("Fault injection updated: db-slowdown enabled={} delayMs={}", enabled, delayMs);
            }
            case "cpu-spike" -> {
                faultConfig.getCpuSpike().setEnabled(enabled);
                log.warn("Fault injection updated: cpu-spike enabled={}", enabled);
            }
            default -> throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Unknown fault type: " + type + ". Valid values: db-slowdown, cpu-spike");
        }

        return Map.of("applied", true, "type", type, "enabled", enabled);
    }

    private String extractString(Map<String, Object> map, String key) {
        Object val = map.get(key);
        if (val == null || val.toString().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Missing required field: " + key);
        }
        return val.toString();
    }
}

package com.meridian.journey.web;

import com.meridian.journey.service.FaultGateRegistry;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Runtime control surface for named fault gates (see FaultGateRegistry) --
 * replaces this service's old single-gate {@code POST /admin/fault}
 * endpoint. Same shape as entity-engine's identical controller, so
 * demo-control-api targets every service's fault gates the same way.
 *
 * <p>Gate names are {@code "{entityType}.{triggerStatus}.{failureStatus}"}
 * (e.g. {@code flight.boarding.cancelled}) -- see
 * {@link com.meridian.journey.service.JourneyLifecycleScheduler}.
 */
@RestController
@RequestMapping("/api/v1/admin/fault-gates")
@RequiredArgsConstructor
public class FaultGateAdminController {

    private final FaultGateRegistry registry;

    @GetMapping
    public Map<String, FaultGateRegistry.FaultGateState> list() {
        return registry.snapshot();
    }

    @PostMapping("/{name}")
    public FaultGateRegistry.FaultGateState configure(@PathVariable String name, @RequestBody Map<String, Object> body) {
        Boolean enabled = body.get("enabled") == null ? null : Boolean.valueOf(String.valueOf(body.get("enabled")));
        Double rate = body.get("rate") == null ? null : Double.valueOf(String.valueOf(body.get("rate")));
        return registry.configure(name, enabled, rate);
    }
}

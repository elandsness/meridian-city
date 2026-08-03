package com.meridian.entityengine.web;

import com.meridian.entityengine.service.FaultGateRegistry;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Runtime control surface for named fault gates (see FaultGateRegistry) -- the
 * one consistent replacement for every hand-written per-service /admin/fault
 * endpoint (citizen-service, city-operations, commerce-service, and
 * billing-service each had a differently-shaped payload; this is one shape for
 * every gate, on every entity-engine deployment). demo-control-api targets
 * this instead.
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

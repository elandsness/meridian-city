package com.meridian.entityengine.service;

import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Named, runtime-adjustable fault gates -- generalizes every hand-written
 * FaultState/FaultInjectionConfig class this engine replaces (citizen-service,
 * city-operations, commerce-service, and billing-service each hand-rolled their
 * own {enabled, rate} pair) into one registry any entity-config's faultGate
 * condition can reference by name. A gate not yet configured is seeded from
 * its transition's own declared `probability` (the config-authored default
 * rate); enabled defaults to whether that default rate is positive, so a
 * demo-authored fault (e.g. the synthetic probe's 20% fault_detected branch)
 * still fires out of the box, while a City-style fault (default rate 0.0, off
 * until an SE flips it) stays off until asked. See FaultGateAdminController.
 */
@Component
public class FaultGateRegistry {

    public record FaultGateState(boolean enabled, double rate) {}

    private final Map<String, FaultGateState> gates = new ConcurrentHashMap<>();

    public FaultGateState get(String name, double configuredDefaultRate) {
        return gates.computeIfAbsent(name, k -> new FaultGateState(configuredDefaultRate > 0, configuredDefaultRate));
    }

    public FaultGateState configure(String name, Boolean enabled, Double rate) {
        return gates.compute(name, (k, existing) -> new FaultGateState(
                enabled != null ? enabled : (existing != null && existing.enabled()),
                rate != null ? rate : (existing != null ? existing.rate() : 0.0)));
    }

    public Map<String, FaultGateState> snapshot() {
        return Map.copyOf(gates);
    }
}

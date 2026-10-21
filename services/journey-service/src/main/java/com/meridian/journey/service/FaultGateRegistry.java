package com.meridian.journey.service;

import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Named, runtime-adjustable fault gates -- the same {@code {enabled, rate}}
 * shape as entity-engine's FaultGateRegistry, so demo-control-api drives
 * every service's fault injection through one consistent contract. Replaces
 * this service's old single global FaultState, which gave the whole service
 * one on/off switch -- so two independently-named demo scenarios (e.g.
 * flight-cancellations and passenger-offloads) fought over the same gate.
 * See FaultGateAdminController and JourneyLifecycleScheduler, which looks up
 * a gate per (entity type, current status) pair.
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

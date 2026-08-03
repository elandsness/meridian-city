package com.meridian.entityengine.service;

import com.meridian.entityengine.config.EntityDefinition;
import com.meridian.entityengine.domain.EntityRecord;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Pure decision logic: given an entity's current state, which (if any) declared
 * transition fires next. Deliberately the whole condition vocabulary the Tier-2
 * engine supports — no scripting, no arbitrary branching. Transitions are
 * evaluated in declared order for the record's current `from` state; the first
 * one whose `when` condition passes wins (a direct data-driven mirror of every
 * hand-written scheduler's `switch (state) { case ... }` this replaces).
 */
@Component
@RequiredArgsConstructor
public class TransitionEvaluator {

    private final FaultGateRegistry faultGateRegistry;

    /** Scheduler-driven advancement only -- a userTriggerable transition is reachable
     * exclusively via {@link #findMatchingUserAction}, never picked up by the automatic
     * tick sweep (it would otherwise fire the instant its `from` state is entered, since
     * an unconditional userTriggerable transition has no other condition standing in the
     * way). */
    public EntityDefinition.TransitionDef findMatchingTransition(EntityRecord record, EntityDefinition def) {
        for (EntityDefinition.TransitionDef t : def.getTransitions()) {
            if (t.isUserTriggerable()) continue;
            if (!Objects.equals(t.getFrom(), record.getState())) continue;
            if (conditionMatches(t.getWhen(), record)) {
                return t;
            }
        }
        return null;
    }

    /** POST .../actions/{action}-driven advancement. Matches by declared order same as
     * the scheduler path -- this matters when one action name has multiple branches (e.g.
     * "checkout" gated by a faultGate payment-decline check first, falling through to an
     * unconditional success second): the first transition whose `when` condition currently
     * passes wins, so a probability/faultGate roll only ever happens once per call, not
     * repeatedly like the scheduler's due-entity sweep. */
    public EntityDefinition.TransitionDef findMatchingUserAction(EntityRecord record, EntityDefinition def, String action) {
        for (EntityDefinition.TransitionDef t : def.getTransitions()) {
            if (!t.isUserTriggerable()) continue;
            if (!Objects.equals(t.getFrom(), record.getState())) continue;
            if (!(Objects.equals(action, t.getTo()) || Objects.equals(action, t.getLabel()))) continue;
            if (conditionMatches(t.getWhen(), record)) {
                return t;
            }
        }
        return null;
    }

    private boolean conditionMatches(Map<String, Object> when, EntityRecord record) {
        if (when == null || when.isEmpty()) {
            return true; // unconditional transition
        }
        if (when.containsKey("field")) {
            Object actual = record.getField(String.valueOf(when.get("field")));
            if (when.containsKey("equals")) {
                return Objects.equals(stringify(actual), stringify(when.get("equals")));
            }
            if (when.containsKey("notEquals")) {
                return !Objects.equals(stringify(actual), stringify(when.get("notEquals")));
            }
            return false;
        }
        if (when.containsKey("faultGate")) {
            // faultGate generalizes today's hand-written FaultState.java {enabled, rate}
            // on/off toggle. The value is a gate NAME looked up in the runtime registry;
            // `probability` is only the config-authored default rate used the first time
            // the gate is referenced (see FaultGateRegistry). An admin can flip enabled/
            // rate at runtime via FaultGateAdminController, same as the old /admin/fault
            // endpoints did per-service.
            String gateName = String.valueOf(when.get("faultGate"));
            double configuredDefaultRate = numberOf(when.get("probability"), 0.0);
            FaultGateRegistry.FaultGateState state = faultGateRegistry.get(gateName, configuredDefaultRate);
            return state.enabled() && rollProbability(state.rate());
        }
        if (when.containsKey("probability")) {
            return rollProbability(when.get("probability"));
        }
        if (when.containsKey("link")) {
            // {link: "<refField>", field: "<fieldOnLinkedEntity>", equals: ...}. Not
            // exercised by the Stage 2 synthetic entities (no flow needs it yet);
            // evaluated defensively (never matches) rather than throwing, so an
            // as-yet-unused condition shape doesn't crash the scheduler.
            return false;
        }
        return true;
    }

    private boolean rollProbability(Object probability) {
        double p = numberOf(probability, 0.0);
        return ThreadLocalRandom.current().nextDouble() < p;
    }

    private static double numberOf(Object v, double fallback) {
        if (v instanceof Number n) return n.doubleValue();
        if (v instanceof String s) {
            try { return Double.parseDouble(s); } catch (NumberFormatException ignored) { }
        }
        return fallback;
    }

    private static String stringify(Object v) {
        return v == null ? null : String.valueOf(v);
    }
}

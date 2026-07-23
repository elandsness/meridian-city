package com.meridian.entityengine.service;

import com.meridian.entityengine.config.EntityDefinition;
import com.meridian.entityengine.domain.EntityRecord;
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
public class TransitionEvaluator {

    public EntityDefinition.TransitionDef findMatchingTransition(EntityRecord record, EntityDefinition def) {
        for (EntityDefinition.TransitionDef t : def.getTransitions()) {
            if (!Objects.equals(t.getFrom(), record.getState())) continue;
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
            // faultGate generalizes today's hand-written FaultState.java on/off toggle
            // (e.g. the "Business Failures" admin switch). No live per-instance toggle
            // is wired into the engine yet -- that's a Stage 6/7 concern when a real
            // retrofit needs an admin endpoint to flip it. Until then a fault-gated
            // transition behaves as if the gate is always on, i.e. a pure probability
            // roll, so the synthetic proof can still exercise the branch.
            return rollProbability(when.get("probability"));
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

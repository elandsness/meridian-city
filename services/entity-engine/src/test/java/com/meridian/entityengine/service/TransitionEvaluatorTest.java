package com.meridian.entityengine.service;

import com.meridian.entityengine.config.EntityDefinition;
import com.meridian.entityengine.domain.EntityRecord;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for the core, novel logic this whole initiative depends on: given
 * an entity's state and fields, which declared transition (if any) fires next.
 * No Spring context / DB needed -- pure decision logic, tested directly against
 * shapes mirroring the probe/inspection synthetic entities in dev-entity-config.json.
 */
class TransitionEvaluatorTest {

    private final TransitionEvaluator evaluator = new TransitionEvaluator(new FaultGateRegistry());

    private static EntityDefinition.TransitionDef transition(String from, String to, Map<String, Object> when) {
        EntityDefinition.TransitionDef t = new EntityDefinition.TransitionDef();
        t.setFrom(from);
        t.setTo(to);
        t.setWhen(when);
        return t;
    }

    private static EntityRecord recordIn(String state, Map<String, Object> fields) {
        EntityRecord r = new EntityRecord();
        r.setState(state);
        fields.forEach(r::setField);
        return r;
    }

    @Test
    void unconditionalTransitionAlwaysMatches() {
        EntityDefinition def = new EntityDefinition();
        def.setTransitions(List.of(transition("queued", "scanning", null)));

        EntityDefinition.TransitionDef result = evaluator.findMatchingTransition(recordIn("queued", Map.of()), def);

        assertNotNull(result);
        assertEquals("scanning", result.getTo());
    }

    @Test
    void fieldEqualsBranch_takesTheMatchingBranch_optionalStepShape() {
        // Mirrors inspection: assigned -> detail_check (thorough=true) | assigned -> approved (thorough=false).
        EntityDefinition def = new EntityDefinition();
        def.setTransitions(List.of(
                transition("assigned", "detail_check", Map.of("field", "thorough", "equals", true)),
                transition("assigned", "approved", Map.of("field", "thorough", "equals", false))
        ));

        EntityDefinition.TransitionDef thorough = evaluator.findMatchingTransition(
                recordIn("assigned", Map.of("thorough", true)), def);
        EntityDefinition.TransitionDef notThorough = evaluator.findMatchingTransition(
                recordIn("assigned", Map.of("thorough", false)), def);

        assertEquals("detail_check", thorough.getTo());
        assertEquals("approved", notThorough.getTo());
    }

    @Test
    void firstDeclaredMatchWins_whenMultipleConditionsCouldApply() {
        EntityDefinition def = new EntityDefinition();
        def.setTransitions(List.of(
                transition("scanning", "fault_detected", Map.of("probability", 1.0)),
                transition("scanning", "validating", null)
        ));

        // probability=1.0 always rolls true, so the FIRST declared transition should win
        // even though the second (unconditional) one would also match.
        EntityDefinition.TransitionDef result = evaluator.findMatchingTransition(recordIn("scanning", Map.of()), def);

        assertEquals("fault_detected", result.getTo());
    }

    @Test
    void faultGateZeroDefaultRate_neverMatches_soDeclaredOrderFallsThrough() {
        // A faultGate's default rate of 0.0 seeds the named gate as disabled (matching
        // every hand-written FaultState's own off-by-default convention) -- it must
        // never fire until something explicitly enables it via FaultGateAdminController.
        EntityDefinition def = new EntityDefinition();
        def.setTransitions(List.of(
                transition("scanning", "fault_detected", Map.of("faultGate", "test-fault", "probability", 0.0)),
                transition("scanning", "validating", null)
        ));

        EntityDefinition.TransitionDef result = evaluator.findMatchingTransition(recordIn("scanning", Map.of()), def);

        assertEquals("validating", result.getTo());
    }

    @Test
    void faultGatePositiveDefaultRate_isEnabledOutOfTheBox() {
        // A positive default rate seeds the gate as enabled (e.g. a demo-authored fault
        // meant to fire out of the box, like the synthetic probe's fault_detected branch)
        // -- probability 1.0 always rolls true once enabled.
        EntityDefinition def = new EntityDefinition();
        def.setTransitions(List.of(
                transition("scanning", "fault_detected", Map.of("faultGate", "always-on-fault", "probability", 1.0)),
                transition("scanning", "validating", null)
        ));

        EntityDefinition.TransitionDef result = evaluator.findMatchingTransition(recordIn("scanning", Map.of()), def);

        assertEquals("fault_detected", result.getTo());
    }

    @Test
    void noMatchingTransitionFromCurrentState_returnsNull() {
        EntityDefinition def = new EntityDefinition();
        def.setTransitions(List.of(transition("queued", "scanning", null)));

        EntityDefinition.TransitionDef result = evaluator.findMatchingTransition(recordIn("complete", Map.of()), def);

        assertNull(result);
    }

    @Test
    void unresolvedLinkCondition_defensivelyNeverMatches() {
        EntityDefinition def = new EntityDefinition();
        def.setTransitions(List.of(transition("assigned", "approved", Map.of("link", "probe_id", "field", "zone", "equals", "north"))));

        EntityDefinition.TransitionDef result = evaluator.findMatchingTransition(recordIn("assigned", Map.of()), def);

        assertNull(result); // not yet implemented -- must not throw, must not silently match
    }
}

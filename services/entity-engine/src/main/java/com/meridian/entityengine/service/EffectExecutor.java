package com.meridian.entityengine.service;

import com.meridian.entityengine.domain.EntityRecord;
import com.meridian.entityengine.repository.EntityRecordRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

/**
 * Applies a transition's declared {@code effects} to `self` or a linked entity
 * (`link.<refFieldName>`). Runs in the same transaction as the triggering
 * transition (see TransitionScheduler), so a same-service cross-entity effect
 * is atomically consistent -- an upgrade over today's best-effort HTTP links
 * (e.g. PassengerService.pickDepartingFlight()) for any pair of entity types
 * that end up owned by the same entity-service instance.
 *
 * <p>Only `set`/`increment` are implemented for Stage 2's synthetic proof.
 * `transition`/`spawnLinked`/`callService` are real, schema-declared effect
 * kinds (see docs/industry-config.schema.json) that no current flow needs yet
 * -- logged and skipped rather than thrown, so an as-yet-unimplemented effect
 * kind never crashes the scheduler.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class EffectExecutor {

    private final EntityRecordRepository repository;

    public void apply(EntityRecord source, List<Map<String, Object>> effects) {
        for (Map<String, Object> effect : effects) {
            String target = String.valueOf(effect.get("target"));
            String action = String.valueOf(effect.get("action"));
            String field = effect.get("field") == null ? null : String.valueOf(effect.get("field"));

            EntityRecord targetRecord = resolveTarget(source, target);
            if (targetRecord == null) {
                log.debug("Effect target \"{}\" not resolvable from entity {} (unset link or missing target) -- skipping, best-effort.",
                        target, source.getId());
                continue;
            }

            switch (action) {
                case "set" -> targetRecord.setField(field, effect.get("value"));
                case "increment" -> increment(targetRecord, field, effect.get("by"));
                case "transition", "spawnLinked", "callService" ->
                        log.warn("Effect action \"{}\" is declared but not yet implemented (no current flow needs it) -- skipping.", action);
                default -> log.warn("Unknown effect action \"{}\" -- skipping.", action);
            }

            if (targetRecord != source) {
                repository.save(targetRecord);
            }
        }
    }

    private EntityRecord resolveTarget(EntityRecord source, String target) {
        if ("self".equals(target)) return source;
        if (target != null && target.startsWith("link.")) {
            String refField = target.substring("link.".length());
            String linkedId = source.getLink(refField);
            return linkedId == null ? null : repository.findById(linkedId).orElse(null);
        }
        return null;
    }

    private void increment(EntityRecord record, String field, Object byValue) {
        double delta = numberOf(byValue, 1.0);
        double base = numberOf(record.getField(field), 0.0);
        double result = base + delta;
        record.setField(field, result == Math.floor(result) ? (Object) (long) result : (Object) result);
    }

    private static double numberOf(Object v, double fallback) {
        if (v instanceof Number n) return n.doubleValue();
        if (v instanceof String s) {
            try { return Double.parseDouble(s); } catch (NumberFormatException ignored) { }
        }
        return fallback;
    }
}

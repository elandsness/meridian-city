package com.meridian.entityengine.service;

import com.meridian.entityengine.config.EntityConfigLoader;
import com.meridian.entityengine.config.EntityDefinition;
import com.meridian.entityengine.domain.EntityEventRecord;
import com.meridian.entityengine.domain.EntityRecord;
import com.meridian.entityengine.repository.EntityEventRecordRepository;
import com.meridian.entityengine.repository.EntityRecordRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Set;
import java.util.concurrent.ThreadLocalRandom;

/**
 * The generic entity engine's core: create, read, and drive entities of any
 * type purely from its {@link EntityDefinition}. No entity-type-specific code
 * lives here or anywhere else in this service -- that is the whole point.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class EntityEngineService {

    private final EntityRecordRepository repository;
    private final EntityEventRecordRepository eventRepository;
    private final EntityConfigLoader configLoader;
    private final TransitionEvaluator transitionEvaluator;
    private final EffectExecutor effectExecutor;
    private final EntityEventLogger eventLogger;

    public List<EntityRecord> list(String entityType, String stateFilter) {
        configLoader.require(entityType);
        return stateFilter == null
                ? repository.findByEntityType(entityType)
                : repository.findByEntityTypeAndState(entityType, stateFilter);
    }

    public EntityRecord get(String entityType, String id) {
        return repository.findByIdAndEntityType(id, entityType)
                .orElseThrow(() -> new NoSuchElementException(entityType + " " + id + " not found"));
    }

    /** User-triggered action, e.g. POST /api/v1/entities/{type}/{id}/actions/{action}. */
    @Transactional
    public EntityRecord runAction(String entityType, String id, String action) {
        EntityDefinition def = configLoader.require(entityType);
        EntityRecord record = get(entityType, id);
        EntityDefinition.TransitionDef transition = def.getTransitions().stream()
                .filter(t -> t.isUserTriggerable()
                        && t.getFrom().equals(record.getState())
                        && (action.equals(t.getTo()) || action.equals(t.getLabel())))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException(
                        "No user-triggerable action \"" + action + "\" from state \"" + record.getState() + "\""));
        return applyTransition(record, def, transition);
    }

    /** Creates one new instance in its `initial` state, applying field generation and linkOnCreate. */
    @Transactional
    public EntityRecord create(String entityType, Map<String, Object> fieldOverrides) {
        EntityDefinition def = configLoader.require(entityType);
        EntityRecord record = EntityRecord.create(entityType, def.getIdPrefix(), def.getInitial());

        def.getFields().forEach((fieldName, fieldDef) -> {
            Object override = fieldOverrides == null ? null : fieldOverrides.get(fieldName);
            record.setField(fieldName, override != null ? override : generateFieldValue(fieldName, fieldDef, def));
        });

        applyLinkOnCreate(record, def);
        scheduleNext(record, def);
        repository.save(record);
        return record;
    }

    /** Evaluates and, if a transition matches, applies it. Called by TransitionScheduler for due entities. */
    @Transactional
    public void advanceIfDue(String entityType, EntityRecord record) {
        EntityDefinition def = configLoader.require(entityType);
        EntityDefinition.TransitionDef transition = transitionEvaluator.findMatchingTransition(record, def);
        if (transition == null) {
            // No declared transition's condition currently passes; re-check on the
            // next tick rather than spinning forever (e.g. a probability roll that
            // hasn't hit yet).
            record.setNextTransitionAt(OffsetDateTime.now().plusSeconds(1));
            repository.save(record);
            return;
        }
        applyTransition(record, def, transition);
    }

    private EntityRecord applyTransition(EntityRecord record, EntityDefinition def, EntityDefinition.TransitionDef transition) {
        String fromState = record.getState();
        record.setState(transition.getTo());
        record.setStateEnteredAt(OffsetDateTime.now());
        scheduleNext(record, def);

        if (!transition.getEffects().isEmpty()) {
            effectExecutor.apply(record, transition.getEffects());
        }

        repository.save(record);
        eventRepository.save(EntityEventRecord.of(record, fromState, transition.getTo()));
        eventLogger.transitioned(record, fromState);
        return record;
    }

    /**
     * Sets next_transition_at for the state the record just entered. Multiple
     * transitions can leave the same state (branching); since which one
     * eventually fires depends on conditions evaluated at check time, the
     * check-again delay is taken from the FIRST declared transition out of the
     * new state that has a timer (consistent with "declared order, first match
     * wins" everywhere else in the engine). A transition without a timer is
     * treated as checkable on the very next tick. No outgoing transitions at
     * all (a terminal state) leaves next_transition_at null, same as today's
     * hand-written schedulers.
     */
    private void scheduleNext(EntityRecord record, EntityDefinition def) {
        EntityDefinition.TransitionDef next = def.getTransitions().stream()
                .filter(t -> t.getFrom().equals(record.getState()))
                .findFirst()
                .orElse(null);
        if (next == null) {
            record.setNextTransitionAt(null);
            return;
        }
        EntityDefinition.TimerDef timer = next.getTimer();
        if (timer == null || timer.getMinSeconds() == null) {
            record.setNextTransitionAt(OffsetDateTime.now());
            return;
        }
        double min = timer.getMinSeconds();
        double max = timer.getMaxSeconds() != null ? timer.getMaxSeconds() : min;
        double delaySeconds = min >= max ? min : ThreadLocalRandom.current().nextDouble(min, max);
        record.setNextTransitionAt(OffsetDateTime.now().plusSeconds((long) delaySeconds));
    }

    private void applyLinkOnCreate(EntityRecord record, EntityDefinition def) {
        def.getLinkOnCreate().forEach((refField, linkDef) -> {
            Map<String, Object> query = linkDef.getQuery();
            if (query == null) return;
            String targetEntityType = String.valueOf(query.get("entity"));
            Map<String, Object> filter = castMap(query.get("filter"));
            List<String> excludeStates = filter == null ? List.of() : castStringList(filter.get("stateNotIn"));

            List<EntityRecord> candidates = repository.findByEntityTypeAndStateNotIn(targetEntityType, excludeStates);
            if (candidates.isEmpty()) {
                if (linkDef.isRequired()) {
                    throw new IllegalStateException("linkOnCreate for " + refField + " found no candidate " + targetEntityType + " and is required");
                }
                return; // best-effort, matching today's pickDepartingFlight() behavior
            }
            EntityRecord picked = candidates.get(ThreadLocalRandom.current().nextInt(candidates.size()));
            record.setLink(refField, picked.getId());
        });
    }

    private Object generateFieldValue(String fieldName, EntityDefinition.FieldDef fieldDef, EntityDefinition def) {
        if (fieldDef.getDefaultValue() != null) return fieldDef.getDefaultValue();

        Map<String, Object> hint = def.getGenerator() == null ? null : def.getGenerator().getFields().get(fieldName);
        String type = fieldDef.getType();
        if ("boolean".equals(type)) {
            double probability = hint != null && hint.get("probability") instanceof Number n ? n.doubleValue() : 0.5;
            return ThreadLocalRandom.current().nextDouble() < probability;
        }
        if ("enum".equals(type) && fieldDef.getValues() != null && !fieldDef.getValues().isEmpty()) {
            List<String> values = fieldDef.getValues();
            return values.get(ThreadLocalRandom.current().nextInt(values.size()));
        }
        if ("number".equals(type)) return 0;
        if ("ref".equals(type)) return null; // resolved via linkOnCreate, not per-field generation
        return fieldName + "-" + ThreadLocalRandom.current().nextInt(10000); // string / date fallback
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> castMap(Object o) {
        return o instanceof Map<?, ?> m ? (Map<String, Object>) m : null;
    }

    @SuppressWarnings("unchecked")
    private static List<String> castStringList(Object o) {
        return o instanceof List<?> l ? (List<String>) l : List.of();
    }

    /** Terminal states for the "active count" a generator's maxActive caps against. */
    public static Set<String> terminalStates(EntityDefinition def) {
        return def.getStates().entrySet().stream()
                .filter(e -> e.getValue().isTerminal())
                .map(Map.Entry::getKey)
                .collect(java.util.stream.Collectors.toSet());
    }
}

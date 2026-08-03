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
    private final EntityFactory entityFactory;

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
        EntityDefinition.TransitionDef transition = transitionEvaluator.findMatchingUserAction(record, def, action);
        if (transition == null) {
            throw new IllegalStateException(
                    "No user-triggerable action \"" + action + "\" from state \"" + record.getState() + "\"");
        }
        return applyTransition(record, def, transition);
    }

    /** Creates one new instance in its `initial` state, applying field generation and linkOnCreate. */
    @Transactional
    public EntityRecord create(String entityType, Map<String, Object> fieldOverrides) {
        EntityDefinition def = configLoader.require(entityType);
        EntityRecord record = entityFactory.build(def, entityType, fieldOverrides);
        applyLinkOnCreate(record, def);
        entityFactory.scheduleNext(record, def);
        repository.save(record);
        entityFactory.recordCreation(record, def);
        return record;
    }

    /**
     * Client-submitted create, e.g. POST /api/v1/entities/{type} (a citizen
     * registering, a service request being submitted, a cart item being added)
     * -- unlike generator/spawnLinked creates, a missing required field here is
     * the caller's mistake, not a config-authoring gap, so it's rejected with a
     * 400 rather than silently filled in.
     */
    @Transactional
    public EntityRecord createFromClient(String entityType, Map<String, Object> fields) {
        EntityDefinition def = configLoader.require(entityType);
        List<String> missing = def.getFields().entrySet().stream()
                .filter(e -> e.getValue().isRequired())
                .filter(e -> fields == null || fields.get(e.getKey()) == null)
                .map(Map.Entry::getKey)
                .toList();
        if (!missing.isEmpty()) {
            throw new IllegalArgumentException(entityType + " missing required field(s): " + missing);
        }
        return create(entityType, fields);
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
        entityFactory.scheduleNext(record, def);

        if (!transition.getEffects().isEmpty()) {
            effectExecutor.apply(record, transition.getEffects());
        }

        repository.save(record);
        eventRepository.save(EntityEventRecord.of(record, fromState, transition.getTo()));
        eventLogger.transitioned(record, fromState, def);
        return record;
    }

    private void applyLinkOnCreate(EntityRecord record, EntityDefinition def) {
        def.getLinkOnCreate().forEach((refField, linkDef) -> {
            if (record.getLink(refField) != null) return; // already set by an explicit client-supplied ref field
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

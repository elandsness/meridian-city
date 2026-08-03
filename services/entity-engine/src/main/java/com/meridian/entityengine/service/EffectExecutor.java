package com.meridian.entityengine.service;

import com.meridian.entityengine.config.EntityConfigLoader;
import com.meridian.entityengine.config.EntityDefinition;
import com.meridian.entityengine.domain.EntityEventRecord;
import com.meridian.entityengine.domain.EntityRecord;
import com.meridian.entityengine.repository.EntityEventRecordRepository;
import com.meridian.entityengine.repository.EntityRecordRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Applies a transition's declared {@code effects}. `set`/`increment` target
 * `self` or a linked entity (`link.<refFieldName>`) and run in the same
 * transaction as the triggering transition, so a same-service cross-entity
 * effect is atomically consistent -- an upgrade over today's best-effort HTTP
 * links (e.g. PassengerService.pickDepartingFlight()) for any pair of entity
 * types owned by the same entity-service instance.
 *
 * <p>`spawnLinked` creates a brand-new linked entity in the SAME service (also
 * atomic, in the same transaction) -- e.g. an incident spawning its work
 * order. `callService` is an outbound HTTP call to a DIFFERENT service (e.g.
 * routing-service, or the other entity-service) -- deliberately best-effort,
 * matching today's DispatchClient/pickDepartingFlight precedent: a downstream
 * failure is logged and skipped, never rolls back the transition that
 * triggered it.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class EffectExecutor {

    private final EntityRecordRepository repository;
    private final EntityEventRecordRepository eventRepository;
    private final EntityConfigLoader configLoader;
    private final EntityFactory entityFactory;
    private final EntityEventLogger eventLogger;
    private final RestTemplate restTemplate;
    private final Environment environment;

    public void apply(EntityRecord source, List<Map<String, Object>> effects) {
        for (Map<String, Object> effect : effects) {
            String action = String.valueOf(effect.get("action"));
            switch (action) {
                case "set", "increment" -> applyFieldEffect(source, effect, action);
                case "spawnLinked" -> applySpawnLinked(source, effect);
                case "callService" -> applyCallService(source, effect);
                case "transition" -> applyDirectTransition(source, effect);
                default -> log.warn("Unknown effect action \"{}\" -- skipping.", action);
            }
        }
    }

    /** Forces a linked entity directly into a declared state -- e.g. a work_order's
     * "resolved" transition cascading its parent incident to "resolved" too. Deliberately
     * bypasses the target's own transition conditions (this is an explicit cross-entity
     * cascade the SOURCE side declared, not a normal scheduled/user-triggered advancement)
     * but still runs the target's usual scheduleNext + event-logging, so the cascade is
     * indistinguishable from a normal transition to any downstream consumer (Business
     * Flow steps, the frontend's state-driven rendering, ...). */
    private void applyDirectTransition(EntityRecord source, Map<String, Object> effect) {
        String target = String.valueOf(effect.get("target"));
        String to = String.valueOf(effect.get("to"));
        EntityRecord targetRecord = resolveTarget(source, target);
        if (targetRecord == null) {
            log.debug("Effect target \"{}\" not resolvable from entity {} (unset link or missing target) -- skipping, best-effort.",
                    target, source.getId());
            return;
        }
        EntityDefinition targetDef = configLoader.require(targetRecord.getEntityType());
        String fromState = targetRecord.getState();
        targetRecord.setState(to);
        targetRecord.setStateEnteredAt(OffsetDateTime.now());
        entityFactory.scheduleNext(targetRecord, targetDef);
        repository.save(targetRecord);
        eventRepository.save(EntityEventRecord.of(targetRecord, fromState, to));
        eventLogger.transitioned(targetRecord, fromState, targetDef);
    }

    private void applyFieldEffect(EntityRecord source, Map<String, Object> effect, String action) {
        String target = String.valueOf(effect.get("target"));
        String field = effect.get("field") == null ? null : String.valueOf(effect.get("field"));
        EntityRecord targetRecord = resolveTarget(source, target);
        if (targetRecord == null) {
            log.debug("Effect target \"{}\" not resolvable from entity {} (unset link or missing target) -- skipping, best-effort.",
                    target, source.getId());
            return;
        }
        if ("set".equals(action)) {
            targetRecord.setField(field, effect.get("value"));
        } else {
            increment(targetRecord, field, effect.get("by"));
        }
        if (targetRecord != source) {
            repository.save(targetRecord);
        }
    }

    /** Creates a new entity of `entityType`, atomically, in the same transaction as the
     * triggering transition -- fields are resolved from `source` via the same {value|from
     * [,map,default]} spec shape callService's body uses. */
    private void applySpawnLinked(EntityRecord source, Map<String, Object> effect) {
        String targetType = String.valueOf(effect.get("entityType"));
        EntityDefinition targetDef = configLoader.require(targetType);
        Map<String, Object> resolved = resolveFieldSpecs(source, castMap(effect.get("fields")));

        EntityRecord spawned = entityFactory.build(targetDef, targetType, resolved);
        entityFactory.scheduleNext(spawned, targetDef);
        repository.save(spawned);
        entityFactory.recordCreation(spawned, targetDef);
        log.info("spawnLinked: created {} {} from {} {}", targetType, spawned.getId(), source.getEntityType(), source.getId());
    }

    /** Outbound HTTP call to another service -- e.g. asking routing-service for a
     * department, or asking another entity-service to create a linked entity. Best-effort:
     * a downstream failure is logged and skipped, never thrown (matching DispatchClient's
     * existing precedent of leaving the source entity exactly as the transition already
     * set it). */
    private void applyCallService(EntityRecord source, Map<String, Object> effect) {
        String url = environment.resolvePlaceholders(String.valueOf(effect.get("url")));
        HttpMethod method = HttpMethod.valueOf(effect.get("method") == null ? "POST" : String.valueOf(effect.get("method")));
        Map<String, Object> body = resolveFieldSpecs(source, castMap(effect.get("body")));

        try {
            @SuppressWarnings("rawtypes")
            ResponseEntity<Map> response = restTemplate.exchange(url, method, new HttpEntity<>(body), Map.class);
            @SuppressWarnings("unchecked")
            Map<String, Object> responseBody = response.getBody();
            Map<String, Object> responseFields = castMap(effect.get("responseFields"));
            if (responseBody != null && responseFields != null) {
                responseFields.forEach((selfField, responseKey) -> source.setField(selfField, responseBody.get(String.valueOf(responseKey))));
            }
        } catch (RestClientException ex) {
            log.warn("callService to {} failed for {} {}: {}", url, source.getEntityType(), source.getId(), ex.getMessage());
        }
    }

    /** Resolves a {fieldName: spec} map (spawnLinked's `fields`, callService's `body`)
     * against `source`, where each spec is {value: <literal>} | {from: "<fieldName>"|"id"
     * [, map: {rawValue: mappedValue}, default: <fallback>]}. */
    private Map<String, Object> resolveFieldSpecs(EntityRecord source, Map<String, Object> specs) {
        Map<String, Object> resolved = new LinkedHashMap<>();
        if (specs != null) {
            specs.forEach((field, spec) -> resolved.put(field, resolveFieldSpec(source, spec)));
        }
        return resolved;
    }

    private Object resolveFieldSpec(EntityRecord source, Object spec) {
        if (!(spec instanceof Map<?, ?> rawSpec)) return spec; // plain literal shorthand
        Map<String, Object> specMap = castMap(rawSpec);

        Object raw;
        if (specMap.containsKey("value")) {
            raw = specMap.get("value");
        } else if (specMap.containsKey("from")) {
            String from = String.valueOf(specMap.get("from"));
            if ("id".equals(from)) {
                raw = source.getId();
            } else {
                // A ref-typed field's real value lives in `links`, not `data` (see
                // EntityFactory.build) -- fall back to it when the plain field is unset.
                Object fieldValue = source.getField(from);
                raw = fieldValue != null ? fieldValue : source.getLink(from);
            }
        } else {
            raw = null;
        }

        Map<String, Object> valueMap = castMap(specMap.get("map"));
        if (valueMap != null) {
            Object mapped = valueMap.get(String.valueOf(raw));
            return mapped != null ? mapped : specMap.getOrDefault("default", raw);
        }
        return raw;
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

    @SuppressWarnings("unchecked")
    private static Map<String, Object> castMap(Object o) {
        return o instanceof Map<?, ?> m ? (Map<String, Object>) m : null;
    }
}

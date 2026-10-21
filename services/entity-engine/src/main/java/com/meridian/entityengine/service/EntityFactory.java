package com.meridian.entityengine.service;

import com.meridian.entityengine.config.EntityDefinition;
import com.meridian.entityengine.domain.EntityEventRecord;
import com.meridian.entityengine.domain.EntityRecord;
import com.meridian.entityengine.repository.EntityEventRecordRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Builds a new EntityRecord from an EntityDefinition + field overrides, and
 * computes when it's next due.
 */
@Component
@RequiredArgsConstructor
public class EntityFactory {

    private final EntityEventRecordRepository eventRepository;
    private final EntityEventLogger eventLogger;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    public EntityRecord build(EntityDefinition def, String entityType, Map<String, Object> fieldOverrides) {
        return build(def, entityType, fieldOverrides, Map.of());
    }

    public EntityRecord build(EntityDefinition def, String entityType, Map<String, Object> fieldOverrides,
                               Map<String, Set<Object>> usedValuesByField) {
        EntityRecord record = EntityRecord.create(entityType, def.getIdPrefix(), def.getInitial());
        if (fieldOverrides != null && fieldOverrides.get("owner_id") != null) {
            record.setOwnerId(String.valueOf(fieldOverrides.get("owner_id")));
        }
        def.getFields().forEach((fieldName, fieldDef) -> {
            Object override = fieldOverrides == null ? null : fieldOverrides.get(fieldName);
            if ("ref".equals(fieldDef.getType())) {
                if (override != null) record.setLink(fieldName, String.valueOf(override));
                return;
            }
            Object value = override != null
                    ? override
                    : generateFieldValue(fieldName, fieldDef, def, usedValuesByField.get(fieldName));
            boolean isPassword = "password".equals(fieldDef.getType());
            record.setField(fieldName, isPassword && value != null ? passwordEncoder.encode(String.valueOf(value)) : value);
        });
        return record;
    }

    public void scheduleNext(EntityRecord record, EntityDefinition def) {
        EntityDefinition.TransitionDef next = def.getTransitions().stream()
                .filter(t -> !t.isUserTriggerable())
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

    /**
     * Ensures that every new entity starts with a complete, contiguous history of events.
     * If the entity is created in a state beyond 'initial', we backfill the sequence
     * from the a-priori config with staggered timestamps to avoid "orphaned events" in Dynatrace.
     */
    public void recordCreation(EntityRecord record, EntityDefinition def) {
        String currentState = record.getState();
        List<String> sequence = new ArrayList<>();
        
        // We use a temporary variable and a loop to rebuild the sequence.
        // Since Java lambdas require effectively final variables, we avoid using 
        // a variable that changes inside the loop in the filter.
        String targetState = currentState;
        while (targetState != null && !targetState.equals(def.getInitial())) {
            final String currentTarget = targetState; // Create effectively final copy for lambda
            EntityDefinition.TransitionDef transition = def.getTransitions().stream()
                    .filter(t -> t.getTo().equals(currentTarget))
                    .findFirst()
                    .orElse(null);
            if (transition == null) break;
            sequence.add(0, transition.getFrom());
            targetState = transition.getFrom();
        }

        OffsetDateTime now = OffsetDateTime.now();
        long totalOffsetMins = 30 + ThreadLocalRandom.current().nextInt(31);
        
        OffsetDateTime firstEventTime = now.minusMinutes(totalOffsetMins);
        EntityEventRecord firstEvent = EntityEventRecord.of(record, null, def.getInitial());
        firstEvent.setOccurredAt(firstEventTime);
        eventRepository.save(firstEvent);
        eventLogger.transitioned(record, null, null, def, firstEventTime);

        if (!sequence.isEmpty()) {
            long gapMins = totalOffsetMins / (sequence.size() + 1);
            for (int i = 0; i < sequence.size(); i++) {
                String state = sequence.get(i);
                OffsetDateTime eventTime = firstEventTime.plusMinutes(gapMins * (i + 1));
                
                String fromState = (i == 0) ? def.getInitial() : sequence.get(i - 1);
                EntityDefinition.TransitionDef transition = def.getTransitions().stream()
                        .filter(t -> t.getTo().equals(state))
                        .findFirst()
                        .orElse(null);
                EntityEventRecord event = EntityEventRecord.of(record, fromState, state);
                event.setOccurredAt(eventTime);
                eventRepository.save(event);
                eventLogger.transitioned(record, fromState, transition, def, eventTime);
            }
        }
    }

    private Object generateFieldValue(String fieldName, EntityDefinition.FieldDef fieldDef, EntityDefinition def,
                                       Set<Object> usedValues) {
        if (fieldDef.getDefaultValue() != null) return fieldDef.getDefaultValue();
        Object rawHint = def.getGenerator() == null ? null : def.getGenerator().getFields().get(fieldName);
        if (rawHint == null) return null;

        String type = fieldDef.getType();

        if (rawHint instanceof List<?> list && !list.isEmpty()) {
            Object picked = list.get(ThreadLocalRandom.current().nextInt(list.size()));
            if (picked instanceof Map<?, ?> map) {
                Object vals = map.get("values");
                if (vals instanceof List<?> values && !values.isEmpty()) {
                    return pickValue(values, fieldDef.isUnique() ? usedValues : null);
                }
            }
            return String.valueOf(picked);
        }

        if (rawHint instanceof Map<?, ?> rawMap) {
            Map<String, Object> hint = (Map<String, Object>) rawMap;
            if ("boolean".equals(type)) {
                double probability = hint.get("probability") instanceof Number n ? n.doubleValue() : 0.5;
                return ThreadLocalRandom.current().nextDouble() < probability;
            }
            if ("enum".equals(type) && fieldDef.getValues() != null && !fieldDef.getValues().isEmpty()) {
                List<String> values = fieldDef.getValues();
                return values.get(ThreadLocalRandom.current().nextInt(values.size()));
            }
            if ("number".equals(type)) {
                Number min = hint.get("min") instanceof Number n ? n : null;
                Number max = hint.get("max") instanceof Number n ? n : null;
                if (min != null && max != null) {
                    return Math.round(ThreadLocalRandom.current().nextDouble(min.doubleValue(), max.doubleValue()));
                }
                return 0;
            }
            if ("string".equals(type)) {
                String faker = hint.get("faker") instanceof String s ? s : null;
                if ("fullName".equals(faker)) return randomFullName();
                if ("firstName".equals(faker)) return randomFirstName();
                if ("lastName".equals(faker)) return randomLastName();
                if ("streetAddress".equals(faker)) return randomAddress();
                if (hint.get("values") instanceof List<?> vals && !vals.isEmpty()) {
                    return String.valueOf(vals.get(ThreadLocalRandom.current().nextInt(vals.size())));
                }
            }
        }
        return null;
    }

    /** Picks a random value, preferring one not in `excluded` if that still leaves a choice. */
    private String pickValue(List<?> values, Set<Object> excluded) {
        List<?> candidates = values;
        if (excluded != null && !excluded.isEmpty()) {
            List<?> remaining = values.stream().filter(v -> !excluded.contains(String.valueOf(v))).toList();
            if (!remaining.isEmpty()) candidates = remaining;
        }
        return String.valueOf(candidates.get(ThreadLocalRandom.current().nextInt(candidates.size())));
    }

    private static final String[] FIRST_NAMES = {
        "Alice", "Bob", "Carlos", "Diana", "Ethan", "Fatima", "Grace", "Henry",
        "Isabella", "James", "Kiran", "Laura", "Marcus", "Nadia", "Omar", "Priya",
        "Quinn", "Rachel", "Samuel", "Tanya", "Uma", "Victor", "Wendy", "Xavier",
        "Yasmin", "Zoe", "Aaron", "Brianna", "Cole", "Danielle", "Eric", "Fiona",
        "George", "Hannah", "Ian", "Julia", "Kevin", "Lily", "Michael", "Nina"
    };

    private static final String[] LAST_NAMES = {
        "Adams", "Baker", "Carter", "Davis", "Evans", "Foster", "Garcia", "Harris",
        "Ivanova", "Johnson", "Khan", "Lee", "Martinez", "Nelson", "O'Brien", "Patel",
        "Quinn", "Rivera", "Smith", "Taylor", "Usman", "Vasquez", "Williams", "Xu",
        "Young", "Zhang", "Anderson", "Brown", "Clark", "Diaz", "Edwards", "Flores"
    };

    private static final String[] STREETS = {
        "Main St", "Oak Ave", "Maple Dr", "Cedar Ln", "Elm St", "Park Blvd",
        "Washington Ave", "Lincoln Rd", "Jefferson Blvd", "Madison Ct"
    };

    private String randomFirstName() {
        return FIRST_NAMES[ThreadLocalRandom.current().nextInt(FIRST_NAMES.length)];
    }

    private String randomLastName() {
        return LAST_NAMES[ThreadLocalRandom.current().nextInt(LAST_NAMES.length)];
    }

    private String randomFullName() {
        return randomFirstName() + " " + randomLastName();
    }

    private String randomAddress() {
        int num = ThreadLocalRandom.current().nextInt(100, 9999);
        String street = STREETS[ThreadLocalRandom.current().nextInt(STREETS.length)];
        return num + " " + street;
    }
}

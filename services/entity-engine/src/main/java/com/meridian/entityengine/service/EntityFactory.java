package com.meridian.entityengine.service;

import com.meridian.entityengine.config.EntityDefinition;
import com.meridian.entityengine.domain.EntityEventRecord;
import com.meridian.entityengine.domain.EntityRecord;
import com.meridian.entityengine.repository.EntityEventRecordRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Builds a new EntityRecord from an EntityDefinition + field overrides, and
 * computes when it's next due -- the record-creation logic shared by
 * EntityEngineService.create() (generator/client creates) and EffectExecutor's
 * spawnLinked effect (an entity created as a side effect of another entity's
 * transition), so neither duplicates the other's field-default/timer/eventing
 * logic. Deliberately has no dependency on EntityEngineService itself (which
 * depends on EffectExecutor) to avoid a circular bean graph.
 */
@Component
@RequiredArgsConstructor
public class EntityFactory {

    private final EntityEventRecordRepository eventRepository;
    private final EntityEventLogger eventLogger;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    public EntityRecord build(EntityDefinition def, String entityType, Map<String, Object> fieldOverrides) {
        EntityRecord record = EntityRecord.create(entityType, def.getIdPrefix(), def.getInitial());
        def.getFields().forEach((fieldName, fieldDef) -> {
            Object override = fieldOverrides == null ? null : fieldOverrides.get(fieldName);
            if ("ref".equals(fieldDef.getType())) {
                // A ref field's real value lives in `links` (see EntityRecord.setLink), not
                // `data` -- storing it as a plain field too would leave a perpetually-null
                // duplicate under the same name (Stage 2 never exercised a client-supplied
                // ref value, only generator-resolved linkOnCreate). An explicit client
                // override sets the link now; an unset one is left for applyLinkOnCreate.
                if (override != null) record.setLink(fieldName, String.valueOf(override));
                return;
            }
            Object value = override != null ? override : generateFieldValue(fieldName, fieldDef, def);
            boolean isPassword = "password".equals(fieldDef.getType());
            record.setField(fieldName, isPassword && value != null ? passwordEncoder.encode(String.valueOf(value)) : value);
        });
        return record;
    }

    /**
     * Sets next_transition_at for the state the record just entered. Multiple
     * transitions can leave the same state (branching); since which one
     * eventually fires depends on conditions evaluated at check time, the
     * check-again delay is taken from the FIRST declared, non-userTriggerable
     * transition out of the state that has a timer (consistent with "declared
     * order, first match wins" everywhere else in the engine). userTriggerable
     * transitions are excluded here for the same reason TransitionEvaluator
     * excludes them from the scheduler sweep: a state whose only way out is an
     * explicit user action (e.g. a bill sitting "outstanding" until paid, a
     * cart sitting "open" until checked out) must get next_transition_at=null,
     * not "due immediately," or the scheduler would spin on it forever finding
     * no scheduler-eligible transition to apply. A transition without a timer
     * is treated as checkable on the very next tick. No outgoing
     * non-userTriggerable transitions at all leaves next_transition_at null.
     */
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
     * Every entity's very first business event -- entering its `initial` state
     * counts as a transition too (from=null) -- so a derived flow's first step
     * (always the initial state, per provision-dynatrace-business-config.py's
     * _topo_walk) actually has an event to alert/fund a KPI on. Call once,
     * right after the record is persisted, for every creation path (generator,
     * client create, spawnLinked).
     */
    public void recordCreation(EntityRecord record, EntityDefinition def) {
        eventRepository.save(EntityEventRecord.of(record, null, record.getState()));
        eventLogger.transitioned(record, null, def);
    }

    private Object generateFieldValue(String fieldName, EntityDefinition.FieldDef fieldDef, EntityDefinition def) {
        if (fieldDef.getDefaultValue() != null) return fieldDef.getDefaultValue();

        Object rawHint = def.getGenerator() == null ? null : def.getGenerator().getFields().get(fieldName);
        @SuppressWarnings("unchecked")
        Map<String, Object> hint = rawHint instanceof Map<?, ?> m ? (Map<String, Object>) m : null;
        String type = fieldDef.getType();
        if ("boolean".equals(type)) {
            double probability = hint != null && hint.get("probability") instanceof Number n ? n.doubleValue() : 0.5;
            return ThreadLocalRandom.current().nextDouble() < probability;
        }
        if ("enum".equals(type) && fieldDef.getValues() != null && !fieldDef.getValues().isEmpty()) {
            List<String> values = fieldDef.getValues();
            return values.get(ThreadLocalRandom.current().nextInt(values.size()));
        }
        if ("number".equals(type)) {
            if (hint != null) {
                Number min = hint.get("min") instanceof Number n ? n : null;
                Number max = hint.get("max") instanceof Number n ? n : null;
                if (min != null && max != null) {
                    return Math.round(ThreadLocalRandom.current().nextDouble(min.doubleValue(), max.doubleValue()));
                }
            }
            return 0;
        }
        if ("string".equals(type) && hint != null) {
            String faker = hint.get("faker") instanceof String s ? s : null;
            if ("fullName".equals(faker)) return randomFullName();
            if ("firstName".equals(faker)) return randomFirstName();
            if ("lastName".equals(faker)) return randomLastName();
            if ("streetAddress".equals(faker)) return randomAddress();
        }
        // ref: resolved via linkOnCreate, not per-field generation. password: only ever
        // client-supplied (a generator has no plaintext to hash) -- stays unset otherwise.
        // string/date without a default stay null; optional timestamp fields like paid_at
        // must be set explicitly via a transition effect, not auto-populated with noise.
        return null;
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

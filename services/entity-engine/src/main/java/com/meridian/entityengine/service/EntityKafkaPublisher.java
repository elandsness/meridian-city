package com.meridian.entityengine.service;

import com.meridian.entityengine.config.EntityConfigLoader;
import com.meridian.entityengine.domain.EntityRecord;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

/**
 * Publishes entity-lifecycle events to the Kafka topics that downstream
 * consumers (notification-service) listen on. The payload's "owner_id" key
 * is a fixed wire-contract name across every industry; notification-service
 * reads it generically and never sees the source entity's own field name
 * (see {@link #ownerField}).
 *
 * `bill` keeps its own hand-written mapping (its two states map to
 * domain-specific event names and payload fields — "tax.bill_issued" /
 * "tax.payment_completed" with period/amount_cents — that aren't derivable
 * from the state name alone). Every other entity type is fully generic:
 * reaching any state marked `notify: true` in its config
 * (`entities.<type>.states.<state>.notify`) publishes a
 * "<entity_type>.<state>" event with no entity type or state name
 * special-cased in code — see {@link #publishRequestEvent}.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class EntityKafkaPublisher {

    private final KafkaTemplate<String, Map<String, Object>> kafkaTemplate;
    private final EntityConfigLoader configLoader;

    /** Called after every state transition (applyTransition) and after issueOutstanding. */
    public void publish(EntityRecord record) {
        try {
            String entityType = record.getEntityType();
            if (entityType.equals("bill")) {
                publishBillEvent(record);
                return;
            }
            var def = configLoader.getAllDefinitions().get(entityType);
            var stateDef = def != null ? def.getStates().get(record.getState()) : null;
            if (stateDef != null && stateDef.isNotify()) {
                publishRequestEvent(record);
            }
        } catch (Exception e) {
            // Non-fatal: Kafka publish failures must not roll back entity state.
            log.warn("Kafka publish failed for {}/{} state={}: {}",
                    record.getEntityType(), record.getId(), record.getState(), e.getMessage());
        }
    }

    private void publishBillEvent(EntityRecord record) {
        String state = record.getState();
        String eventType = switch (state) {
            case "outstanding" -> "tax.bill_issued";
            case "paid" -> "tax.payment_completed";
            default -> null;
        };
        if (eventType == null) return;

        var def = configLoader.getAllDefinitions().get("bill");
        String displayName = def != null && def.getDisplayName() != null ? def.getDisplayName() : "Tax Bill";

        Map<String, Object> payload = new HashMap<>();
        payload.put("event_type", eventType);
        payload.put("owner_id", record.getField(ownerField("bill")));
        payload.put("period", record.getField("period"));
        payload.put("amount_cents", record.getField("amount_cents"));
        payload.put("bill_id", record.getId());
        payload.put("display_name", displayName);
        kafkaTemplate.send("billing.events", record.getId(), payload);
    }

    /** Caller has already confirmed the current state is notify:true. */
    private void publishRequestEvent(EntityRecord record) {
        String state = record.getState();
        String entityType = record.getEntityType();
        Map<String, Object> payload = new HashMap<>();
        payload.put("event_type", entityType + "." + state);
        payload.put("owner_id", record.getField(ownerField(entityType)));
        payload.put("status", state);
        payload.put("request_id", record.getId());
        kafkaTemplate.send("requests.events", record.getId(), payload);
    }

    /**
     * notification-service's consumers always key on an "owner_id" payload field,
     * but the source entity's own field for that id varies per industry (e.g.
     * "citizen_id" for city, "passenger_id" for airport) — reuses
     * generator.ownerField (the existing owner-entity-linking concept) to resolve
     * it. No industry-specific default: an entity type that omits ownerField gets
     * a null id (notification-service already drops those) with a loud warning,
     * rather than silently guessing a field name that happens to be right for one
     * industry and wrong for others.
     */
    private String ownerField(String entityType) {
        var def = configLoader.getAllDefinitions().get(entityType);
        var gen = def != null ? def.getGenerator() : null;
        String field = gen != null ? gen.getOwnerField() : null;
        if (field == null) {
            log.warn("entityType={} has no generator.ownerField configured — published events "
                    + "for it will carry a null owner id and be dropped by notification-service",
                    entityType);
        }
        return field;
    }
}

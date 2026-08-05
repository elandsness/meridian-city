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
 * consumers (notification-service) already listen on. Payload shapes match
 * those topics' existing contracts so notification-service needs no changes.
 *
 * Only emits for entity type + state combinations that have a downstream
 * consumer — everything else is a no-op.
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
            switch (record.getEntityType()) {
                case "bill" -> publishBillEvent(record);
                case "service_request" -> publishRequestEvent(record);
                default -> { /* no downstream consumer for this type */ }
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
        payload.put("citizen_id", record.getField("citizen_id"));
        payload.put("period", record.getField("period"));
        payload.put("amount_cents", record.getField("amount_cents"));
        payload.put("bill_id", record.getId());
        payload.put("display_name", displayName);
        kafkaTemplate.send("billing.events", record.getId(), payload);
    }

    private void publishRequestEvent(EntityRecord record) {
        String state = record.getState();
        if (!state.equals("submitted") && !state.equals("resolved")) return;

        Map<String, Object> payload = new HashMap<>();
        payload.put("event_type", "service_request." + state);
        payload.put("citizen_id", record.getField("citizen_id"));
        payload.put("status", state);
        payload.put("request_id", record.getId());
        kafkaTemplate.send("requests.events", record.getId(), payload);
    }
}

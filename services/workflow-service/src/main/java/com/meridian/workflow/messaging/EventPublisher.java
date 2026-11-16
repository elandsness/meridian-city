package com.meridian.workflow.messaging;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

@Service
public class EventPublisher {
    private static final Logger log = LoggerFactory.getLogger(EventPublisher.class);
    private final KafkaTemplate<String, Object> kafkaTemplate;

    public EventPublisher(KafkaTemplate<String, Object> kafkaTemplate) {
        this.kafkaTemplate = kafkaTemplate;
    }

    public void publishEvent(String entityId, String entityType, String state) {
        publishEvent(entityId, null, entityType, state);
    }

    public void publishEvent(String entityId, String ownerId, String entityType, String state) {
        String eventType = entityType + "." + state;
        String topic = "events";
        
        EventPayload payload = new EventPayload(entityId, ownerId, eventType, state);
        
        log.info("Publishing event: topic={} entityId={} eventType={} ownerId={}", topic, entityId, eventType, ownerId);
        kafkaTemplate.send(topic, entityId, payload);
    }

    public record EventPayload(String entityId, String ownerId, String eventType, String state) {}
}
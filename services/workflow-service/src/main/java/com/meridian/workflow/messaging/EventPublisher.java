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
        String eventType = entityType + "." + state;
        String topic = "events";
        
        // Simple event payload
        EventPayload payload = new EventPayload(entityId, eventType, state);
        
        log.info("Publishing event: topic={} entityId={} eventType={}", topic, entityId, eventType);
        kafkaTemplate.send(topic, entityId, payload);
    }

    public record EventPayload(String entityId, String eventType, String state) {}
}

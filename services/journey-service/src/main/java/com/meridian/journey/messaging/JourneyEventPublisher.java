package com.meridian.journey.messaging;

import com.meridian.journey.domain.Journey;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Publishes journey lifecycle events to Kafka (journey.events). Consumed by
 * notification-service (per-citizen inbox) and analytics. camelCase payloads (Java/Node convention).
 */
@Component
public class JourneyEventPublisher {

    private static final Logger log = LoggerFactory.getLogger(JourneyEventPublisher.class);
    private static final String TOPIC = "journey.events";

    private final KafkaTemplate<String, Object> kafkaTemplate;

    public JourneyEventPublisher(KafkaTemplate<String, Object> kafkaTemplate) {
        this.kafkaTemplate = kafkaTemplate;
    }

    public void publishJourneyEvent(String eventType, Journey journey) {
        Map<String, Object> event = new LinkedHashMap<>();
        event.put("eventType", eventType);
        event.put("journeyId", journey.getId());
        event.put("entityType", journey.getEntityType());
        event.put("status", journey.getStatus());
        event.put("progress", journey.getProgress());
        send(journey.getId(), event);
    }

    private void send(String key, Map<String, Object> event) {
        kafkaTemplate.send(TOPIC, key, event).whenComplete((result, ex) -> {
            if (ex != null) {
                log.warn("Failed to publish journey event {} key={}: {}",
                        event.get("eventType"), key, ex.getMessage());
            } else {
                log.debug("Published journey event {} key={}", event.get("eventType"), key);
            }
        });
    }
}

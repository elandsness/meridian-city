package com.meridian.identity.messaging;

import com.meridian.identity.domain.Identity;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * Publishes identity lifecycle events to the identity.events topic. Downstream
 * services (transaction-service, workflow-service) consume identity.registered
 * for various purposes (e.g., generating tax-bill history, creating default workflows).
 */
@Component
public class IdentityEventPublisher {

    private static final Logger log = LoggerFactory.getLogger(IdentityEventPublisher.class);
    private static final String TOPIC = "identity.events";

    private final KafkaTemplate<String, Object> kafkaTemplate;

    public IdentityEventPublisher(KafkaTemplate<String, Object> kafkaTemplate) {
        this.kafkaTemplate = kafkaTemplate;
    }

    public void publishIdentityRegistered(Identity identity) {
        Map<String, Object> event = Map.of(
                "eventType", "identity.registered",
                "identityId", identity.getId(),
                "email", identity.getEmail() != null ? identity.getEmail() : "",
                "zoneId", identity.getZoneId() != null ? identity.getZoneId() : ""
        );
        kafkaTemplate.send(TOPIC, identity.getId(), event)
                .whenComplete((result, ex) -> {
                    if (ex != null) {
                        log.warn("Failed to publish identity.registered for identityId={}: {}",
                                identity.getId(), ex.getMessage());
                    } else {
                        log.debug("Published identity.registered for identityId={} to topic={}",
                                identity.getId(), TOPIC);
                    }
                });
    }
}

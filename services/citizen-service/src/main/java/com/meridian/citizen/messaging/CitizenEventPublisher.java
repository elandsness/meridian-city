package com.meridian.citizen.messaging;

import com.meridian.citizen.domain.Citizen;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * Publishes citizen lifecycle events to the citizens.events topic. billing-service
 * consumes citizen.registered to generate a tax-bill history for new citizens.
 */
@Component
public class CitizenEventPublisher {

    private static final Logger log = LoggerFactory.getLogger(CitizenEventPublisher.class);
    private static final String TOPIC = "citizens.events";

    private final KafkaTemplate<String, Object> kafkaTemplate;

    public CitizenEventPublisher(KafkaTemplate<String, Object> kafkaTemplate) {
        this.kafkaTemplate = kafkaTemplate;
    }

    public void publishCitizenRegistered(Citizen citizen) {
        Map<String, Object> event = Map.of(
                "eventType", "citizen.registered",
                "citizenId", citizen.getId(),
                "email", citizen.getEmail() != null ? citizen.getEmail() : "",
                "zoneId", citizen.getZoneId() != null ? citizen.getZoneId() : ""
        );
        kafkaTemplate.send(TOPIC, citizen.getId(), event)
                .whenComplete((result, ex) -> {
                    if (ex != null) {
                        log.warn("Failed to publish citizen.registered for citizenId={}: {}",
                                citizen.getId(), ex.getMessage());
                    } else {
                        log.debug("Published citizen.registered for citizenId={} to topic={}",
                                citizen.getId(), TOPIC);
                    }
                });
    }
}

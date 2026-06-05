package com.meridian.citizen.messaging;

import com.meridian.citizen.domain.ServiceRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
public class RequestEventPublisher {

    private static final Logger log = LoggerFactory.getLogger(RequestEventPublisher.class);
    private static final String TOPIC = "requests.events";

    private final KafkaTemplate<String, Object> kafkaTemplate;

    public RequestEventPublisher(KafkaTemplate<String, Object> kafkaTemplate) {
        this.kafkaTemplate = kafkaTemplate;
    }

    public void publishRequestSubmitted(ServiceRequest request) {
        Map<String, Object> event = Map.of(
                "eventType", "service_request.submitted",
                "requestId", request.getId(),
                "citizenId", request.getCitizenId(),
                "category", request.getCategory(),
                "priority", request.getPriority(),
                "status", request.getStatus(),
                "zoneId", request.getZoneId() != null ? request.getZoneId() : ""
        );

        kafkaTemplate.send(TOPIC, request.getId(), event)
                .whenComplete((result, ex) -> {
                    if (ex != null) {
                        log.warn("Failed to publish request event for requestId={}: {}",
                                request.getId(), ex.getMessage());
                    } else {
                        log.debug("Published request event for requestId={} to topic={}",
                                request.getId(), TOPIC);
                    }
                });
    }
}

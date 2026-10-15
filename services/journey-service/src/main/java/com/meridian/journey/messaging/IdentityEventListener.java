package com.meridian.journey.messaging;

import com.meridian.journey.domain.Journey;
import com.meridian.journey.domain.JourneyConfig;
import com.meridian.journey.service.JourneyService;
import com.meridian.journey.repository.JourneyConfigRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.kafka.support.KafkaHeaders;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

/**
 * Listens for identity lifecycle events from the identity-service.
 * When a new citizen is registered, it checks industry config for
 * user-linked entities and spawns a journey for each.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class IdentityEventListener {

    private final JourneyService journeyService;
    private final JourneyConfigRepository configRepository;

    @KafkaListener(topics = "identity.events", groupId = "journey-service-group")
    public void onIdentityEvent(@Header(KafkaHeaders.RECEIVED_KEY) String key, Map<String, Object> payload) {
        String eventType = (String) payload.get("eventType");
        if (!"identity.registered".equals(eventType)) {
            return;
        }

        String identityId = (String) payload.get("identityId");
        String email = (String) payload.get("email");

        log.info("Received identity.registered event for userId={} (email={}). Checking for user-linked journeys...", identityId, email);

        // Find all journey types that are flagged as tied to users
        List<JourneyConfig> linkedConfigs = configRepository.findByIsUserLinkedTrue();

        if (linkedConfigs.isEmpty()) {
            log.info("No user-linked journeys configured. Skipping.");
            return;
        }

        for (JourneyConfig cfg : linkedConfigs) {
            log.info("Spawning personal journey for user {} of type {}", identityId, cfg.getEntityType());
            
            Journey journey = Journey.create(
                    cfg.getEntityType(),
                    email != null ? email : "Guest",
                    identityId,
                    "inbound",
                    "Registration",
                    "Journey Start",
                    null,
                    "initiated"
            );

            journeyService.create(journey);
        }
    }
}
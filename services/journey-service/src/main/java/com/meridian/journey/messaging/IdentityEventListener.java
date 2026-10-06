package com.meridian.journey.messaging;

import com.meridian.journey.domain.Journey;
import com.meridian.journey.service.JourneyService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * Listens for identity lifecycle events from the identity-service.
 * When a new citizen is registered, it automatically triggers the creation
 * of a personal journey flow.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class IdentityEventListener {

    private final JourneyService journeyService;

    @KafkaListener(topics = "identity.events", groupId = "journey-service-group")
    public void onIdentityEvent(String key, Map<String, Object> payload) {
        String eventType = (String) payload.get("eventType");
        if (!"identity.registered".equals(eventType)) {
            return;
        }

        String identityId = (String) payload.get("identityId");
        String email = (String) payload.get("email");

        log.info("Received identity.registered event for userId={} (email={}). Spawning personal journey...", identityId, email);

        // Create a personal journey for this user.
        // For a demo, we use a simplified 'passenger' journey.
        Journey journey = Journey.create(
                "passenger",
                email != null ? email : "Guest Passenger",
                identityId,
                "inbound",
                "Registration",
                "Journey Start",
                null,
                "initiated"
        );

        journeyService.create(journey);
        log.info("Personal journey created for user {}: id={}", identityId, journey.getId());
    }
}

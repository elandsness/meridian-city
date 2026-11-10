package com.meridian.journey.messaging;

import com.meridian.journey.dto.CreateJourneyRequest;
import com.meridian.journey.service.JourneyService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.kafka.annotation.KafkaListener;

@Component
public class IdentityEventListener {
    private static final Logger log = LoggerFactory.getLogger(IdentityEventListener.class);
    private final JourneyService journeyService;

    public IdentityEventListener(JourneyService journeyService) {
        this.journeyService = journeyService;
    }

    @KafkaListener(topics = "identity.updates")
    public void onIdentityUpdate(CreateJourneyRequest request) {
        log.info("Received identity update for ID: {}", request.getIdentityId());
        try {
            journeyService.initializeJourney(request);
        } catch (Exception e) {
            log.error("Failed to initialize journey for {}: {}", request.getIdentityId(), e.getMessage());
        }
    }
}
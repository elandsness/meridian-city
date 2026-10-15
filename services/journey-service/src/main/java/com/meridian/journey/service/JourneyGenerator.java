package com.meridian.journey.service;

import com.meridian.journey.config.JourneyLifecycleProperties;
import com.meridian.journey.domain.Journey;
import com.meridian.journey.repository.JourneyRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class JourneyGenerator {

    private final JourneyRepository journeyRepository;
    private final JourneyLifecycleProperties lifecycleProperties;
    private final JourneyService journeyService;

    @Scheduled(fixedRateString = "${journey.generator.interval-ms:60000}")
    @Transactional
    public void generateJourneys() {
        log.info("Tick: Generating new journeys...");

        // Avoid over-saturating the board
        List<String> activeStatuses = lifecycleProperties.getActiveStatuses();
        if (journeyRepository.countByStatusIn(activeStatuses) > 50) {
            log.info("Board is saturated ({} active journeys). Skipping generation.", activeStatuses.size());
            return;
        }

        // This is a simplified generator: in a real system, this would use 
        // industry-specific templates/rules.
        spawnRandomJourney();
    }

    private void spawnRandomJourney() {
        String type = Math.random() > 0.5 ? "passenger" : "flight";
        String name = (type.equals("passenger") ? "Passenger " : "Flight ") + UUID.randomUUID().toString().substring(0, 5);
        
        // Generated journeys are not tied to a specific user
        Journey journey = Journey.create(
                type, name, null, null, 
                "inbound", "Point A", "Point B", 
                null, "initiated");
        
        journeyService.create(journey);
        log.info("Generated random journey: {} [{}]", name, type);
    }
}
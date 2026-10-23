package com.meridian.journey.service;

import com.meridian.journey.config.JourneyGeneratorProperties;
import com.meridian.journey.config.JourneyLifecycleProperties;
import com.meridian.journey.domain.Journey;
import com.meridian.journey.repository.JourneyRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.concurrent.ThreadLocalRandom;

@Service
@RequiredArgsConstructor
@Slf4j
public class JourneyGenerator {

    private final JourneyRepository journeyRepository;
    private final JourneyLifecycleProperties lifecycleProperties;
    private final JourneyGeneratorProperties generatorProperties;
    private final JourneyService journeyService;

    @Scheduled(fixedRateString = \"${journey.generator.interval-ms:60000}\")
    @Transactional
    public void generateJourneys() {
        if (!generatorProperties.isEnabled()) {
            return;
        }

        log.info(\"Tick: Generating new journeys...\");

        List<String> activeStatuses = lifecycleProperties.getActiveStatuses();
        int currentActive = journeyRepository.countByStatusIn(activeStatuses);
        
        if (currentActive >= generatorProperties.getMaxActive()) {
            log.info(\"Board is saturated ({} active journeys). Skipping generation.\", currentActive);
            return;
        }

        spawnGenericJourney();
    }

    private void spawnGenericJourney() {
        String[] types = generatorProperties.getEntityTypes();
        if (types == null || types.length == 0) {
            log.warn(\"No entity types configured for journey generation.\");
            return;
        }

        String type = types[ThreadLocalRandom.current().nextInt(types.length)];
        
        List<JourneyGeneratorProperties.RouteConfig> routes = generatorProperties.getRoutes();
        if (routes == null || routes.isEmpty()) {
            log.warn(\"No routes configured to generate journey for type {}.\", type);
            return;
        }
        
        JourneyGeneratorProperties.RouteConfig route = routes.get(ThreadLocalRandom.current().nextInt(routes.size()));
        
        String name = type.substring(0, 1).toUpperCase() + type.substring(1) + \" \" + 
                     UUID.randomUUID().toString().substring(0, 5);

        String initialStatus = generatorProperties.getInitialStatuses() != null 
            ? generatorProperties.getInitialStatuses().get(type) 
            : \"initiated\";

        String metadata = createMetadata(type);

        Journey journey = Journey.create(
                type, name, null, null, 
                \"inbound\", route.getOrigin(), route.getDestination(), 
                metadata, initialStatus,
                route.getOriginX(), route.getOriginY(), route.getDestX(), route.getDestY());
        
        journeyService.create(journey);
        log.info(\"Generated journey: {} [{}] from {} to {}\", name, type, route.getOrigin(), route.getDestination());
    }

    private String createMetadata(String type) {
        if (\"passenger\".equalsIgnoreCase(type)) {
            boolean hasBag = ThreadLocalRandom.current().nextDouble() < generatorProperties.getBagProbability();
            return String.format(\"{\\\"has_bag\\\": %b}\", hasBag);
        }
        return null;
    }
}

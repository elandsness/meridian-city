package com.meridian.journey.service;

import com.meridian.journey.config.JourneyGeneratorProperties;
import com.meridian.journey.config.JourneyLifecycleProperties;
import com.meridian.journey.dto.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.*;
import java.util.concurrent.ThreadLocalRandom;

@Service
public class JourneyGenerator {
    private static final Logger log = LoggerFactory.getLogger(JourneyGenerator.class);
    
    private final JourneyGeneratorProperties generatorProps;
    private final JourneyLifecycleProperties lifecycleProps;

    public JourneyGenerator(JourneyGeneratorProperties generatorProps, JourneyLifecycleProperties lifecycleProps) {
        this.generatorProps = generatorProps;
        this.lifecycleProps = lifecycleProps;
    }

    public Journey generate(String identityId, String entityType) {
        log.info("Generating journey for {} of type {}", identityId, entityType);
        
        String type = (entityType != null) ? entityType : lifecycleProps.getPrimaryJourneyEntityType();
        
        // Simple mock generation
        Journey journey = new Journey();
        journey.setId(UUID.randomUUID().toString());
        journey.setEntityType(type);
        journey.setRelatedId(identityId);
        journey.setName(type + " " + identityId);
        
        // Random route
        if (generatorProps.getRoutes() != null && !generatorProps.getRoutes().isEmpty()) {
            JourneyGeneratorProperties.RouteConfig route = generatorProps.getRoutes().get(ThreadLocalRandom.current().nextInt(generatorProps.getRoutes().size()));
            journey.setOrigin(route.getOrigin());
            journey.setDestination(route.getDestination());
            journey.setDirection(route.getOrigin() + " -> " + route.getDestination());
            journey.setX(route.getOriginX());
            journey.setY(route.getOriginY());
        } else {
            journey.setOrigin("Unknown");
            journey.setDestination("Unknown");
            journey.setDirection("Unknown");
            journey.setX(0.0);
            journey.setY(0.0);
        }

        journey.setStatus(type == "passenger" ? "DEPARTED" : "ACTIVE");
        journey.setState(type == "passenger" ? "In-Flight" : "Operating");
        journey.setProgress(0.0);
        journey.setCreatedAt(OffsetDateTime.now());
        journey.setUpdatedAt(OffsetDateTime.now());
        journey.setScheduledAt(OffsetDateTime.now().plusHours(1));

        // Stages
        List<JourneyStage> stages = new ArrayList<>();
        stages.add(new JourneyStage("Check-in", 1, 0.0, OffsetDateTime.now(), null));
        stages.add(new JourneyStage("Boarding", 2, 0.0, null, null));
        stages.add(new JourneyStage("Flight", 3, 0.0, null, null));
        stages.add(new JourneyStage("Arrival", 4, 0.0, null, null));
        journey.setStages(stages);

        return journey;
    }
}

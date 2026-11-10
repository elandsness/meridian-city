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
        
        // 1. Determine the entity type for this journey
        String type = (entityType != null) ? entityType : pickRandomEntityType();
        
        Journey journey = new Journey();
        journey.setId(UUID.randomUUID().toString());
        journey.setEntityType(type);
        journey.setRelatedId(identityId);
        journey.setName(type + " " + identityId);
        
        // 2. Resolve the initial state from config
        String initialStatus = "ACTIVE";
        if (generatorProps.getInitialStatuses() != null && generatorProps.getInitialStatuses().containsKey(type)) {
            initialStatus = generatorProps.getInitialStatuses().get(type);
        }
        journey.setState(initialStatus);
        journey.setStatus(initialStatus.toUpperCase());
        
        // 3. Resolve route and positions
        if (generatorProps.getRoutes() != null && !generatorProps.getRoutes().isEmpty()) {
            JourneyGeneratorProperties.RouteConfig route = generatorProps.getRoutes().get(
                ThreadLocalRandom.current().nextInt(generatorProps.getRoutes().size())
            );
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

        journey.setProgress(0.0);
        journey.setCreatedAt(OffsetDateTime.now());
        journey.setUpdatedAt(OffsetDateTime.now());
        journey.setScheduledAt(OffsetDateTime.now().plusHours(1));

        // 4. Generate stages
        // In a truly generic engine, stages would be derived from the EntityDefinition's state machine.
        // Since we are in journey-service (isolated), we use a standard journey lifecycle.
        List<JourneyStage> stages = new ArrayList<>();
        String[] defaultStages = {"Initiated", "In-Transit", "Delayed", "Arriving", "Completed"};
        for (int i = 0; i < defaultStages.length; i++) {
            stages.add(new JourneyStage(defaultStages[i], i + 1, (double) i / (defaultStages.length - 1), null, null));
        }
        journey.setStages(stages);

        return journey;
    }

    private String pickRandomEntityType() {
        String[] types = generatorProps.getEntityTypes();
        if (types == null || types.length == 0) {
            return lifecycleProps.getPrimaryJourneyEntityType();
        }
        return types[ThreadLocalRandom.current().nextInt(types.length)];
    }
}

package com.meridian.journey.service;

import com.meridian.journey.config.JourneyGeneratorProperties;
import com.meridian.journey.config.JourneyLifecycleProperties;
import com.meridian.journey.dto.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class JourneyService {
    private static final Logger log = LoggerFactory.getLogger(JourneyService.class);
    
    private final JourneyGeneratorProperties generatorProps;
    private final JourneyLifecycleProperties lifecycleProps;
    private final JourneyGenerator generator;
    private final Map<String, Journey> activeJourneys = new ConcurrentHashMap<>();

    public JourneyService(JourneyGeneratorProperties generatorProps, JourneyLifecycleProperties lifecycleProps, JourneyGenerator generator) {
        this.generatorProps = generatorProps;
        this.lifecycleProps = lifecycleProps;
        this.generator = generator;
    }

    public void initializeJourney(CreateJourneyRequest request) {
        String id = request.getIdentityId();
        if (activeJourneys.containsKey(id)) {
            log.info("Journey already active for {}. Skipping.", id);
            return;
        }
        
        log.info("Initializing new journey for identity: {}", id);
        Journey journey = generator.generate(id, request.getEntityType());
        activeJourneys.put(id, journey);
    }

    public JourneyResponse getJourney(String identityId) {
        Journey journey = activeJourneys.get(identityId);
        if (journey == null) {
            log.warn("No active journey found for identity: {}", identityId);
            return null;
        }
        return mapToResponse(journey);
    }

    public void updateJourneyProgress(String identityId, double progress) {
        Journey journey = activeJourneys.get(identityId);
        if (journey != null) {
            journey.setProgress(progress);
            log.debug("Updated progress for {}: {}", identityId, progress);
        }
    }

    public void endJourney(String identityId) {
        Journey journey = activeJourneys.remove(identityId);
        if (journey != null) {
            log.info("Ending journey for {}. Final state: {}", identityId, journey.getStatus());
        }
    }

    private JourneyResponse mapToResponse(Journey j) {
        return JourneyResponse.builder()
            .id(j.getId())
            .entityType(j.getEntityType())
            .name(j.getName())
            .relatedId(j.getRelatedId())
            .direction(j.getDirection())
            .origin(j.getOrigin())
            .destination(j.getDestination())
            .status(j.getStatus())
            .state(j.getState())
            .progress(j.getProgress())
            .position(JourneyResponse.Position.builder().x(j.getX()).y(j.getY()).build())
            .stages(mapStages(j.getStages()))
            .scheduledAt(j.getScheduledAt())
            .createdAt(j.getCreatedAt())
            .updatedAt(j.getUpdatedAt())
            .build();
    }

    private List<JourneyResponse.Stage> mapStages(List<JourneyStage> stages) {
        if (stages == null) return Collections.emptyList();
        List<JourneyResponse.Stage> respStages = new ArrayList<>();
        for (JourneyStage s : stages) {
            respStages.add(JourneyResponse.Stage.builder()
                .stageName(s.getStageName())
                .stageOrder(s.getStageOrder())
                .progress(s.getProgress())
                .enteredAt(s.getEnteredAt())
                .exitedAt(s.getExitedAt())
                .build());
        }
        return respStages;
    }

    public Map<String, Journey> getActiveJourneys() {
        return activeJourneys;
    }
}

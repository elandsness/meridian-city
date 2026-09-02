package com.meridian.journey.service;

import com.meridian.journey.domain.Journey;
import com.meridian.journey.domain.JourneyStage;
import com.meridian.journey.dto.JourneyResponse;
import com.meridian.journey.repository.JourneyRepository;
import com.meridian.journey.repository.JourneyStageRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class JourneyService {

    private final JourneyRepository journeyRepository;
    private final JourneyStageRepository journeyStageRepository;

    @Transactional(readOnly = true)
    public List<JourneyResponse> listByEntityType(String entityType) {
        if (entityType == null || entityType.isBlank()) {
            return List.of();
        }
        return journeyRepository.findByEntityTypeOrderByCreatedAtDesc(entityType).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<JourneyResponse> board(String entityType, String status, String direction) {
        if (entityType == null || entityType.isBlank()) {
            return List.of();
        }
        List<Journey> journeys;
        if (status != null && !status.isBlank()) {
            journeys = journeyRepository.findByEntityTypeAndStatus(entityType, status);
        } else if (direction != null && !direction.isBlank()) {
            journeys = journeyRepository.findByEntityTypeAndDirection(entityType, direction);
        } else {
            journeys = journeyRepository.findByEntityTypeOrderByCreatedAtDesc(entityType);
        }
        return journeys.stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public JourneyResponse get(String id) {
        Journey journey = journeyRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "journey not found: " + id));
        return toResponse(journey);
    }

    @Transactional
    public Journey create(Journey journey) {
        journey = journeyRepository.save(journey);
        log.info("Created journey id={} entityType={} name={}", journey.getId(), journey.getEntityType(), journey.getName());
        return journey;
    }

    private JourneyResponse toResponse(Journey j) {
        List<JourneyStage> stages = journeyStageRepository.findByJourneyIdOrderByStageOrderAsc(j.getId());
        List<JourneyResponse.Stage> stageResponses = stages.stream()
                .map(s -> JourneyResponse.Stage.builder()
                        .stageName(s.getStageName())
                        .stageOrder(s.getStageOrder())
                        .progress(s.getProgress())
                        .enteredAt(s.getEnteredAt())
                        .exitedAt(s.getExitedAt())
                        .build())
                .toList();

        return JourneyResponse.builder()
                .id(j.getId())
                .entityType(j.getEntityType())
                .name(j.getName())
                .relatedId(j.getRelatedId())
                .direction(j.getDirection())
                .origin(j.getOrigin())
                .destination(j.getDestination())
                .status(j.getStatus())
                .progress(j.getProgress())
                .stages(stageResponses)
                .scheduledAt(j.getScheduledAt())
                .createdAt(j.getCreatedAt())
                .updatedAt(j.getUpdatedAt())
                .build();
    }
}

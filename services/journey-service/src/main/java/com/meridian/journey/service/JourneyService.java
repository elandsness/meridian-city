package com.meridian.journey.service;

import com.meridian.journey.config.JourneyLifecycleProperties;
import com.meridian.journey.domain.Journey;
import com.meridian.journey.domain.JourneyStage;
import com.meridian.journey.dto.CreateJourneyRequest;
import com.meridian.journey.dto.JourneyResponse;
import com.meridian.journey.messaging.JourneyEventPublisher;
import com.meridian.journey.repository.JourneyRepository;
import com.meridian.journey.repository.JourneyStageRepository;
import com.meridian.journey.util.BusinessEventLogger;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class JourneyService {

    private final JourneyRepository journeyRepository;
    private final JourneyStageRepository journeyStageRepository;
    private final JourneyEventPublisher journeyEventPublisher;
    private final BusinessEventLogger businessEventLogger;
    private final JourneyLifecycleProperties lifecycleProperties;

    @Transactional(readOnly = true)
    public List<JourneyResponse> listByEntityType(String entityType) {
        if (entityType == null || entityType.isBlank()) {
            return List.of();
        }
        return journeyRepository.findByEntityTypeOrderByCreatedAtDesc(entityType).stream()
                .map(this::toResponse)
                .toList();
    }

    /** Live journey board. entityType/status/direction are all optional filters —
     * an absent entityType returns every journey (e.g. a fleet map that doesn't
     * care about entity type), not an empty list. */
    @Transactional(readOnly = true)
    public List<JourneyResponse> board(String entityType, String status, String direction) {
        List<Journey> journeys;
        boolean hasType = entityType != null && !entityType.isBlank();
        boolean hasStatus = status != null && !status.isBlank();
        boolean hasDirection = direction != null && !direction.isBlank();

        if (hasType && hasStatus) {
            journeys = journeyRepository.findByEntityTypeAndStatus(entityType, status);
        } else if (hasType && hasDirection) {
            journeys = journeyRepository.findByEntityTypeAndDirection(entityType, direction);
        } else if (hasType) {
            journeys = journeyRepository.findByEntityTypeOrderByCreatedAtDesc(entityType);
        } else if (hasStatus) {
            journeys = journeyRepository.findByStatusOrderByCreatedAtDesc(status);
        } else {
            journeys = journeyRepository.findAllByOrderByCreatedAtDesc();
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
        // Without an initial next_transition_at, JourneyLifecycleScheduler's
        // next_transition_at <= now query never matches (NULL <= now is unknown in
        // SQL) and the journey would sit at its initial status/progress forever.
        journey.setNextTransitionAt(OffsetDateTime.now().plusSeconds(lifecycleProperties.nextDelaySeconds()));
        journey = journeyRepository.save(journey);
        log.info("Created journey id={} entityType={} name={}", journey.getId(), journey.getEntityType(), journey.getName());
        return journey;
    }

    /** Creates a journey from an external request (traffic-bot, seed scripts) and
     * emits the same create-time business event + Kafka event the internal
     * generator's journeys get, so external and generated journeys look identical
     * downstream. */
    @Transactional
    public JourneyResponse createFromRequest(CreateJourneyRequest req) {
        Journey journey = Journey.create(
                req.getEntityType(), req.getName(), req.getRelatedId(), req.getDirection(),
                req.getOrigin(), req.getDestination(), req.getMetadata(),
                req.getInitialStatus() != null ? req.getInitialStatus() : "in_progress",
                req.getOriginX(), req.getOriginY(), req.getDestX(), req.getDestY());
        journey.setNextTransitionAt(OffsetDateTime.now().plusSeconds(lifecycleProperties.nextDelaySeconds()));
        journey = journeyRepository.save(journey);
        businessEventLogger.journeyStatus(journey);
        journeyEventPublisher.publishJourneyEvent("journey.created", journey);
        log.info("Created journey id={} entityType={} name={} (external)", journey.getId(), journey.getEntityType(), journey.getName());
        return toResponse(journey);
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
                .state(j.getStatus())
                .progress(j.getProgress())
                .position(interpolatePosition(j))
                .stages(stageResponses)
                .scheduledAt(j.getScheduledAt())
                .createdAt(j.getCreatedAt())
                .updatedAt(j.getUpdatedAt())
                .build();
    }

    /** Linear interpolation between origin/dest coordinates by progress. Null when
     * any coordinate is unset — a journey type with no map visualisation (e.g. a
     * loan application) simply has no position, rather than a guessed (0,0). */
    private JourneyResponse.Position interpolatePosition(Journey j) {
        if (j.getOriginX() == null || j.getOriginY() == null || j.getDestX() == null || j.getDestY() == null) {
            return null;
        }
        double t = Math.max(0.0, Math.min(1.0, j.getProgress()));
        double x = j.getOriginX() + (j.getDestX() - j.getOriginX()) * t;
        double y = j.getOriginY() + (j.getDestY() - j.getOriginY()) * t;
        return JourneyResponse.Position.builder().x(x).y(y).build();
    }
}

package com.meridian.journey.service;

import com.meridian.journey.config.FaultState;
import com.meridian.journey.config.JourneyLifecycleProperties;
import com.meridian.journey.domain.Journey;
import com.meridian.journey.domain.JourneyStage;
import com.meridian.journey.messaging.JourneyEventPublisher;
import com.meridian.journey.repository.JourneyRepository;
import com.meridian.journey.repository.JourneyStageRepository;
import com.meridian.journey.util.BusinessEventLogger;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Advances journeys through their lifecycle on a timer, spacing each transition by a
 * random delay (see {@link JourneyLifecycleProperties}) so the business flow steps are
 * realistically spaced. The next status depends on the journey's entity type and current
 * status, driven by the configured transition map.
 *
 * <p>When fault injection is on, a share of journeys are cancelled/offloaded at a
 * configured stage (e.g., boarding for flights, security for passengers).
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class JourneyLifecycleScheduler {

    private final JourneyRepository journeyRepository;
    private final JourneyStageRepository journeyStageRepository;
    private final BusinessEventLogger businessEventLogger;
    private final JourneyEventPublisher journeyEventPublisher;
    private final JourneyLifecycleProperties props;
    private final FaultState faultState;

    @Scheduled(fixedDelay = 10_000)
    @Transactional
    public void advanceJourneys() {
        if (!props.isEnabled()) {
            return;
        }
        OffsetDateTime now = OffsetDateTime.now();
        List<Journey> due = journeyRepository.findByStatusInAndNextTransitionAtLessThanEqual(
                props.getActiveStatuses(), now);
        for (Journey j : due) {
            try {
                advance(j, now);
            } catch (RuntimeException ex) {
                log.warn("Journey advance failed for id={}: {}", j.getId(), ex.getMessage());
            }
        }
    }

    private void advance(Journey j, OffsetDateTime now) {
        // Check for fault injection (cancellation/offload)
        if (shouldFail(j)) {
            j.setStatus("cancelled");
            j.setUpdatedAt(now);
            j.setNextTransitionAt(null);
            journeyRepository.save(j);
            businessEventLogger.journeyStatus(j);
            journeyEventPublisher.publishJourneyEvent("journey.failed", j);
            return;
        }

        String nextStatus = props.getNextStatus(j.getStatus());
        if (nextStatus == null) {
            j.setNextTransitionAt(null);
            journeyRepository.save(j);
            return;
        }

        j.setStatus(nextStatus);
        j.setProgress(props.progressFor(nextStatus));
        j.setUpdatedAt(now);
        boolean terminal = !props.getActiveStatuses().contains(nextStatus);
        j.setNextTransitionAt(terminal ? null : now.plusSeconds(props.nextDelaySeconds()));
        journeyRepository.save(j);

        // Record the stage transition
        JourneyStage stage = JourneyStage.create(j.getId(), nextStatus, 0, props.progressFor(nextStatus));
        journeyStageRepository.save(stage);

        businessEventLogger.journeyStatus(j);
        journeyEventPublisher.publishJourneyEvent("journey.stage_changed", j);
    }

    /** Gated demo failure: cancel/offload a share of journeys at a configured stage. */
    private boolean shouldFail(Journey j) {
        return faultState.isFailuresEnabled()
                && faultState.getFailureStage() != null
                && faultState.getFailureStage().equals(j.getStatus())
                && ThreadLocalRandom.current().nextDouble() < faultState.getFailureRate();
    }
}

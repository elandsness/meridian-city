package com.meridian.journey.service;

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
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Advances journeys through their lifecycle on a timer, spacing each transition by a
 * random delay (see {@link JourneyLifecycleProperties}) so the business flow steps are
 * realistically spaced. The next status depends on the journey's entity type and current
 * status, driven by the configured transition map.
 *
 * <p>When a fault gate is on for a journey's (entity type, current status) pair, a share
 * of journeys there fail into that gate's configured status instead of advancing normally
 * (e.g. flight.boarding -> cancelled, passenger.security_cleared -> offloaded). See
 * {@link FaultGateRegistry}.
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
    private final FaultGateRegistry faultGateRegistry;

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
        // Check for fault injection -- a gate named "{entityType}.{currentStatus}.*" fires
        // the journey into that gate's failure status instead of advancing normally.
        String failureStatus = rollFailureStatus(j);
        if (failureStatus != null) {
            j.setStatus(failureStatus);
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

    /**
     * Looks for an enabled fault gate named "{entityType}.{currentStatus}.{failureStatus}"
     * for this journey and rolls its rate. Returns the failure status to apply, or null if
     * no gate matches or the roll misses -- named per (entity type, status) so independent
     * demo scenarios (flight-cancellations, passenger-offloads, ...) each get their own
     * on/off switch instead of sharing one gate.
     */
    private String rollFailureStatus(Journey j) {
        String prefix = j.getEntityType() + "." + j.getStatus() + ".";
        for (Map.Entry<String, FaultGateRegistry.FaultGateState> gate : faultGateRegistry.snapshot().entrySet()) {
            String name = gate.getKey();
            FaultGateRegistry.FaultGateState state = gate.getValue();
            if (state.enabled() && name.length() > prefix.length() && name.startsWith(prefix)
                    && ThreadLocalRandom.current().nextDouble() < state.rate()) {
                return name.substring(prefix.length());
            }
        }
        return null;
    }
}

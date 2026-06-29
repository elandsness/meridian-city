package com.meridian.citizen.service;

import com.meridian.citizen.config.RequestLifecycleProperties;
import com.meridian.citizen.domain.ServiceRequest;
import com.meridian.citizen.dto.UpdateRequestStatusDto;
import com.meridian.citizen.repository.ServiceRequestRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Advances service requests through the simulated business flow on a timer, spacing each
 * step by a realistic randomized delay (see {@link RequestLifecycleProperties}):
 * submitted -> validated -> in_progress -> resolved. The dispatched/assigned steps in the
 * middle are emitted by service-dispatch at the absolute targets citizen-service computed
 * at submit time, so the whole flow stays strictly ordered.
 *
 * <p>The cursor is {@code lifecycle_stage} (separate from the user-facing {@code status});
 * requests are picked up via {@code next_transition_at}, so the pre-existing backlog with a
 * NULL value is left untouched. {@code completion-probability < 1} intentionally leaves a
 * slice of requests unresolved, producing a realistic funnel drop-off.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class RequestLifecycleScheduler {

    private final ServiceRequestRepository serviceRequestRepository;
    private final ServiceRequestService serviceRequestService;
    private final RequestLifecycleProperties props;

    @Scheduled(fixedDelay = 5_000)
    @Transactional
    public void advanceRequests() {
        if (!props.isEnabled()) {
            return;
        }
        OffsetDateTime now = OffsetDateTime.now();
        List<ServiceRequest> due = serviceRequestRepository
                .findByLifecycleStageInAndNextTransitionAtLessThanEqual(
                        List.of("submitted", "validated", "in_progress"), now);
        for (ServiceRequest request : due) {
            try {
                advance(request, now);
            } catch (RuntimeException ex) {
                log.warn("Lifecycle advance failed for requestId={}: {}", request.getId(), ex.getMessage());
            }
        }
    }

    private void advance(ServiceRequest request, OffsetDateTime now) {
        switch (request.getLifecycleStage()) {
            case "submitted" -> {
                // Emit the deferred 'validated' step (no status change), then schedule
                // in_progress strictly after the assigned target so the cross-service
                // ordering holds even if assigned fires later than expected.
                serviceRequestService.emitValidated(request);
                OffsetDateTime assignedTarget = request.getAssignedTargetAt();
                OffsetDateTime anchor = (assignedTarget != null && assignedTarget.isAfter(now))
                        ? assignedTarget : now;
                request.setLifecycleStage("validated");
                request.setNextTransitionAt(anchor.plusSeconds(props.nextInProgressDelaySeconds()));
                serviceRequestRepository.save(request);
            }
            case "validated" -> {
                serviceRequestService.updateStatus(request.getId(),
                        new UpdateRequestStatusDto("in_progress", null, null));
                request.setLifecycleStage("in_progress");
                request.setNextTransitionAt(now.plusSeconds(props.nextResolvedDelaySeconds()));
                serviceRequestRepository.save(request);
            }
            case "in_progress" -> {
                if (ThreadLocalRandom.current().nextDouble() <= props.getCompletionProbability()) {
                    serviceRequestService.updateStatus(request.getId(),
                            new UpdateRequestStatusDto("resolved", null, null));
                    request.setResolvedAt(now);
                    request.setLifecycleStage("resolved");
                } else {
                    // Leave it unresolved on purpose (funnel drop-off).
                    request.setLifecycleStage("abandoned");
                }
                request.setNextTransitionAt(null);
                serviceRequestRepository.save(request);
            }
            default -> { /* terminal or unknown stage — nothing to do */ }
        }
    }
}

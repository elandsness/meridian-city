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
 * Advances service requests through the simulated lifecycle on a timer:
 * submitted -> in_progress -> resolved (mirrors the commerce FulfillmentScheduler).
 *
 * <p>This replaces the old traffic-bot {@code handleOpenRequests} PATCH loop so the
 * Business Analytics funnel fills in reliably and isn't bottlenecked by bot traffic.
 * {@code completion-probability < 1} intentionally leaves a slice of requests stuck
 * in_progress, producing a realistic funnel drop-off to investigate in Dynatrace.
 *
 * <p>dispatched/assigned come from service-dispatch at submit time; this scheduler
 * only drives the later steps. Requests are picked up via {@code next_transition_at}
 * (set on submit), so the pre-existing backlog with a NULL value is left untouched.
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
                .findByStatusInAndNextTransitionAtLessThanEqual(List.of("submitted", "in_progress"), now);
        for (ServiceRequest request : due) {
            try {
                advance(request, now);
            } catch (RuntimeException ex) {
                log.warn("Lifecycle advance failed for requestId={}: {}", request.getId(), ex.getMessage());
            }
        }
    }

    private void advance(ServiceRequest request, OffsetDateTime now) {
        switch (request.getStatus()) {
            case "submitted" -> {
                serviceRequestService.updateStatus(request.getId(),
                        new UpdateRequestStatusDto("in_progress", null, null));
                request.setNextTransitionAt(now.plusSeconds(jitter(props.getResolvedAfterSeconds())));
                serviceRequestRepository.save(request);
            }
            case "in_progress" -> {
                if (ThreadLocalRandom.current().nextDouble() <= props.getCompletionProbability()) {
                    serviceRequestService.updateStatus(request.getId(),
                            new UpdateRequestStatusDto("resolved", null, null));
                    request.setResolvedAt(now);
                } // else: leave it unresolved on purpose (funnel drop-off)
                request.setNextTransitionAt(null);
                serviceRequestRepository.save(request);
            }
            default -> { /* terminal or unknown status — nothing to do */ }
        }
    }

    /** ±20% jitter so transitions don't all fire on the same tick. */
    private long jitter(long base) {
        double factor = 0.8 + ThreadLocalRandom.current().nextDouble() * 0.4;
        return Math.max(1L, Math.round(base * factor));
    }
}

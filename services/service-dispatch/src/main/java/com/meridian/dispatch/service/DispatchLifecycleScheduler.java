package com.meridian.dispatch.service;

import com.meridian.dispatch.config.DispatchLifecycleProperties;
import com.meridian.dispatch.domain.DispatchLog;
import com.meridian.dispatch.domain.RequestEvent;
import com.meridian.dispatch.repository.DispatchLogRepository;
import com.meridian.dispatch.repository.RequestEventRepository;
import com.meridian.dispatch.util.BusinessEventLogger;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * Emits the deferred dispatched/assigned business events for the Service Request flow at
 * the absolute target times citizen-service computed at submit. Polls dispatch_log on
 * (status, next_transition_at): dispatch_pending -> assign_pending -> done. Because the
 * targets come from one cumulative computation in citizen-service, the steps stay strictly
 * ordered (validated < dispatched < assigned < in_progress).
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class DispatchLifecycleScheduler {

    private final DispatchLogRepository dispatchLogRepository;
    private final RequestEventRepository requestEventRepository;
    private final BusinessEventLogger businessEventLogger;
    private final DispatchLifecycleProperties props;

    @Scheduled(fixedDelay = 5_000)
    @Transactional
    public void advanceDispatches() {
        if (!props.isEnabled()) {
            return;
        }
        OffsetDateTime now = OffsetDateTime.now();
        List<DispatchLog> due = dispatchLogRepository
                .findByStatusInAndNextTransitionAtLessThanEqual(
                        List.of("dispatch_pending", "assign_pending"), now);
        for (DispatchLog dispatch : due) {
            try {
                advance(dispatch);
            } catch (RuntimeException ex) {
                log.warn("Dispatch lifecycle advance failed for requestId={}: {}",
                        dispatch.getRequestId(), ex.getMessage());
            }
        }
    }

    private void advance(DispatchLog dispatch) {
        switch (dispatch.getStatus()) {
            case "dispatch_pending" -> {
                businessEventLogger.logDispatched(
                        dispatch.getRequestId(), dispatch.getCitizenId(),
                        dispatch.getAssignedDepartment(), dispatch.getZoneId());
                recordEvent(dispatch.getRequestId(), "service_request.dispatched");
                dispatch.setStatus("assign_pending");
                dispatch.setNextTransitionAt(dispatch.getAssignedTargetAt());
                dispatchLogRepository.save(dispatch);
            }
            case "assign_pending" -> {
                businessEventLogger.logAssigned(dispatch.getRequestId(), dispatch.getAssignedDepartment());
                recordEvent(dispatch.getRequestId(), "service_request.assigned");
                dispatch.setStatus("done");
                dispatch.setNextTransitionAt(null);
                dispatchLogRepository.save(dispatch);
            }
            default -> { /* terminal or unknown status — nothing to do */ }
        }
    }

    /** Persist a request lifecycle event for the Business Analytics funnel. */
    private void recordEvent(String requestId, String eventType) {
        requestEventRepository.save(RequestEvent.builder()
                .requestId(requestId)
                .eventType(eventType)
                .build());
    }
}

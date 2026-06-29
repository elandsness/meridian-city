package com.meridian.dispatch.service;

import com.meridian.dispatch.domain.DispatchLog;
import com.meridian.dispatch.domain.RequestEvent;
import com.meridian.dispatch.dto.CreateWorkOrderDto;
import com.meridian.dispatch.dto.DispatchRequestDto;
import com.meridian.dispatch.dto.DispatchResultDto;
import com.meridian.dispatch.repository.DispatchLogRepository;
import com.meridian.dispatch.repository.RequestEventRepository;
import com.meridian.dispatch.util.BusinessEventLogger;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class DispatchService {

    private final RoutingEngine routingEngine;
    private final DispatchLogRepository dispatchLogRepository;
    private final RequestEventRepository requestEventRepository;
    private final CityOperationsClient cityOperationsClient;
    private final BusinessEventLogger businessEventLogger;

    @Transactional
    public DispatchResultDto dispatch(DispatchRequestDto dto) {
        log.info("Dispatching requestId={} category={} zone={}", dto.getRequestId(), dto.getCategory(), dto.getZoneId());

        // 1. Determine assigned department
        String assignedDepartment = routingEngine.assignDepartment(dto.getCategory());
        String routingReason = routingEngine.buildRoutingReason(dto.getCategory(), dto.getZoneId());

        // 2. The dispatched/assigned business events are no longer emitted here. citizen-service
        //    (the Service Request flow's timeline owner) hands us absolute target times so these
        //    two steps land realistically spaced and strictly after 'validated'. We persist a
        //    DispatchLog with that schedule and the DispatchLifecycleScheduler emits each event
        //    when due. When the lifecycle is disabled upstream the targets are null, so we fall
        //    back to emitting both synchronously (legacy behaviour).
        boolean deferred = dto.getDispatchedAt() != null && dto.getAssignedAt() != null;

        DispatchLog dispatchLog = DispatchLog.builder()
                .requestId(dto.getRequestId())
                .citizenId(dto.getCitizenId())
                .category(dto.getCategory())
                .zoneId(dto.getZoneId())
                .assignedDepartment(assignedDepartment)
                .routingReason(routingReason)
                .status(deferred ? "dispatch_pending" : "done")
                .dispatchedTargetAt(dto.getDispatchedAt())
                .assignedTargetAt(dto.getAssignedAt())
                .nextTransitionAt(deferred ? dto.getDispatchedAt() : null)
                .build();
        dispatchLogRepository.save(dispatchLog);

        if (!deferred) {
            // Legacy synchronous path (lifecycle disabled upstream).
            businessEventLogger.logDispatched(
                    dto.getRequestId(), dto.getCitizenId(), assignedDepartment, dto.getZoneId());
            recordEvent(dto.getRequestId(), "service_request.dispatched");
        }

        // 3. Call city-operations to create the work order. This is the real dispatch action and
        //    forms the api-gateway -> citizen-service -> service-dispatch -> city-operations trace.
        //    Catch here so a downstream failure doesn't roll back the DispatchLog/cursor; the
        //    deferred dispatched/assigned emissions still fire on schedule.
        CreateWorkOrderDto workOrderDto = CreateWorkOrderDto.builder()
                .requestId(dto.getRequestId())
                .citizenId(dto.getCitizenId())
                .title(routingReason)
                .department(assignedDepartment)
                .priority(dto.getPriority())
                .zoneId(dto.getZoneId())
                .build();

        try {
            DispatchResultDto result = cityOperationsClient.createWorkOrder(workOrderDto);

            if (!deferred) {
                businessEventLogger.logAssigned(dto.getRequestId(), assignedDepartment);
                recordEvent(dto.getRequestId(), "service_request.assigned");
            }

            return DispatchResultDto.builder()
                    .requestId(dto.getRequestId())
                    .assignedDepartment(assignedDepartment)
                    .status(result.getStatus() != null ? result.getStatus() : "dispatched")
                    .dispatchedAt(result.getDispatchedAt() != null ? result.getDispatchedAt() : dispatchLog.getDispatchedAt())
                    .build();
        } catch (RuntimeException ex) {
            log.error("Work-order creation failed for requestId={}: {} — dispatch logged, events scheduled",
                    dto.getRequestId(), ex.getMessage());
            return DispatchResultDto.builder()
                    .requestId(dto.getRequestId())
                    .assignedDepartment(assignedDepartment)
                    .status("dispatched")
                    .dispatchedAt(dispatchLog.getDispatchedAt())
                    .build();
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

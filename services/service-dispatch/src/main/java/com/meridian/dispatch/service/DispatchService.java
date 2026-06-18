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

        // 2. Log Business Event: service_request.dispatched (+ request_events row
        //    for the ops-dashboard Business Analytics funnel)
        businessEventLogger.logDispatched(
                dto.getRequestId(),
                dto.getCitizenId(),
                assignedDepartment,
                dto.getZoneId()
        );
        recordEvent(dto.getRequestId(), "service_request.dispatched");

        // 3. Save DispatchLog entry
        DispatchLog dispatchLog = DispatchLog.builder()
                .requestId(dto.getRequestId())
                .category(dto.getCategory())
                .zoneId(dto.getZoneId())
                .assignedDepartment(assignedDepartment)
                .routingReason(routingReason)
                .build();
        dispatchLogRepository.save(dispatchLog);

        // 4. Call city-operations to create the work order, then record the
        //    assignment. The dispatched event (step 2) is already persisted; if the
        //    downstream work-order call fails we must NOT lose it, so we catch here
        //    instead of letting the exception roll back the whole transaction. The
        //    request stays "dispatched" and the lifecycle scheduler still advances it.
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

            // 5. Log Business Event: service_request.assigned (+ request_events row)
            businessEventLogger.logAssigned(dto.getRequestId(), assignedDepartment);
            recordEvent(dto.getRequestId(), "service_request.assigned");

            // 6. Return result with consistent assigned department
            return DispatchResultDto.builder()
                    .requestId(dto.getRequestId())
                    .assignedDepartment(assignedDepartment)
                    .status(result.getStatus() != null ? result.getStatus() : "dispatched")
                    .dispatchedAt(result.getDispatchedAt() != null ? result.getDispatchedAt() : dispatchLog.getDispatchedAt())
                    .build();
        } catch (RuntimeException ex) {
            log.error("Work-order creation failed for requestId={}: {} — dispatched recorded, assignment deferred",
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

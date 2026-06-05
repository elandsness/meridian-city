package com.meridian.dispatch.service;

import com.meridian.dispatch.domain.DispatchLog;
import com.meridian.dispatch.dto.CreateWorkOrderDto;
import com.meridian.dispatch.dto.DispatchRequestDto;
import com.meridian.dispatch.dto.DispatchResultDto;
import com.meridian.dispatch.repository.DispatchLogRepository;
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
    private final CityOperationsClient cityOperationsClient;
    private final BusinessEventLogger businessEventLogger;

    @Transactional
    public DispatchResultDto dispatch(DispatchRequestDto dto) {
        log.info("Dispatching requestId={} category={} zone={}", dto.getRequestId(), dto.getCategory(), dto.getZoneId());

        // 1. Determine assigned department
        String assignedDepartment = routingEngine.assignDepartment(dto.getCategory());
        String routingReason = routingEngine.buildRoutingReason(dto.getCategory(), dto.getZoneId());

        // 2. Log Business Event: service_request.dispatched
        businessEventLogger.logDispatched(
                dto.getRequestId(),
                dto.getCitizenId(),
                assignedDepartment,
                dto.getZoneId()
        );

        // 3. Save DispatchLog entry
        DispatchLog dispatchLog = DispatchLog.builder()
                .requestId(dto.getRequestId())
                .category(dto.getCategory())
                .zoneId(dto.getZoneId())
                .assignedDepartment(assignedDepartment)
                .routingReason(routingReason)
                .build();
        dispatchLogRepository.save(dispatchLog);

        // 4. Call city-operations to create work order
        CreateWorkOrderDto workOrderDto = CreateWorkOrderDto.builder()
                .requestId(dto.getRequestId())
                .citizenId(dto.getCitizenId())
                .title(routingReason)
                .department(assignedDepartment)
                .priority(dto.getPriority())
                .zoneId(dto.getZoneId())
                .build();

        DispatchResultDto result = cityOperationsClient.createWorkOrder(workOrderDto);

        // 5. Log Business Event: service_request.assigned
        businessEventLogger.logAssigned(dto.getRequestId(), assignedDepartment);

        // 6. Return result with consistent assigned department
        return DispatchResultDto.builder()
                .requestId(dto.getRequestId())
                .assignedDepartment(assignedDepartment)
                .status(result.getStatus() != null ? result.getStatus() : "dispatched")
                .dispatchedAt(result.getDispatchedAt() != null ? result.getDispatchedAt() : dispatchLog.getDispatchedAt())
                .build();
    }
}

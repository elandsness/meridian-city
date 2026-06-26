package com.meridian.cityops.service;

import com.meridian.cityops.domain.WorkOrder;
import com.meridian.cityops.dto.CreateWorkOrderDto;
import com.meridian.cityops.dto.WorkOrderResponse;
import com.meridian.cityops.messaging.NotificationPublisher;
import com.meridian.cityops.repository.WorkOrderRepository;
import com.meridian.cityops.util.BusinessEventLogger;
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
public class WorkOrderService {

    private final WorkOrderRepository workOrderRepository;
    private final NotificationPublisher notificationPublisher;
    private final BusinessEventLogger businessEventLogger;

    @Transactional
    public WorkOrderResponse createFromRequest(CreateWorkOrderDto dto) {
        WorkOrder workOrder = WorkOrder.createFromRequest(
                dto.getRequestId(),
                dto.getTitle(),
                dto.getDepartment(),
                dto.getPriority(),
                dto.getZoneId()
        );
        workOrder = workOrderRepository.save(workOrder);

        log.info("Created work order id={} for requestId={}", workOrder.getId(), workOrder.getRequestId());

        // Business Event — request-path work orders have no parent incident.
        businessEventLogger.workOrderCreated(
                workOrder.getId(),
                workOrder.getIncidentId(),
                workOrder.getRequestId(),
                workOrder.getAssignedDepartment()
        );

        // Kafka notification
        notificationPublisher.publishWorkOrderCreated(workOrder);

        return toResponse(workOrder);
    }

    @Transactional(readOnly = true)
    public WorkOrderResponse findById(String id) {
        WorkOrder wo = workOrderRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Work order not found: " + id));
        return toResponse(wo);
    }

    @Transactional(readOnly = true)
    public List<WorkOrderResponse> findByStatus(String status) {
        List<WorkOrder> orders = (status != null && !status.isBlank())
                ? workOrderRepository.findByStatus(status)
                : workOrderRepository.findAll();
        return orders.stream().map(this::toResponse).toList();
    }

    @Transactional
    public WorkOrderResponse updateStatus(String id, String status) {
        WorkOrder wo = workOrderRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Work order not found: " + id));
        wo.setStatus(status);
        if ("resolved".equalsIgnoreCase(status) || "closed".equalsIgnoreCase(status)) {
            wo.setResolvedAt(OffsetDateTime.now());
        }
        wo = workOrderRepository.save(wo);
        log.info("Updated work order id={} status={}", wo.getId(), wo.getStatus());
        return toResponse(wo);
    }

    // -------------------------------------------------------------------------

    private WorkOrderResponse toResponse(WorkOrder wo) {
        return WorkOrderResponse.builder()
                .id(wo.getId())
                .requestId(wo.getRequestId())
                .title(wo.getTitle())
                .assignedDepartment(wo.getAssignedDepartment())
                .status(wo.getStatus())
                .priority(wo.getPriority())
                .createdAt(wo.getCreatedAt())
                .build();
    }
}

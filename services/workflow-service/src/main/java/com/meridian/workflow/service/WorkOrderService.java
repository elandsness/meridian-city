package com.meridian.workflow.service;

import com.meridian.workflow.domain.WorkOrder;
import com.meridian.workflow.dto.CreateWorkOrderDto;
import com.meridian.workflow.dto.WorkOrderResponse;
import com.meridian.workflow.repository.WorkOrderRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;

@Service
public class WorkOrderService {

    private static final Logger log = LoggerFactory.getLogger(WorkOrderService.class);

    private final WorkOrderRepository workOrderRepository;

    public WorkOrderService(WorkOrderRepository workOrderRepository) {
        this.workOrderRepository = workOrderRepository;
    }

    @Transactional
    public WorkOrderResponse createWorkOrder(CreateWorkOrderDto request) {
        requireField(request.title(), "title");

        WorkOrder workOrder = WorkOrder.createFromRequest(
                request.requestId(),
                request.citizenId(),
                request.title(),
                request.department(),
                request.priority(),
                request.zoneId()
        );

        workOrder = workOrderRepository.save(workOrder);

        log.info("Work order created: workOrderId={} requestId={}", workOrder.getId(), workOrder.getRequestId());

        return WorkOrderResponse.from(workOrder);
    }

    @Transactional(readOnly = true)
    public WorkOrderResponse findById(String id) {
        return workOrderRepository.findById(id)
                .map(WorkOrderResponse::from)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Work order not found: " + id));
    }

    @Transactional(readOnly = true)
    public java.util.List<WorkOrderResponse> listByStatus(String status) {
        return workOrderRepository.findByStatus(status).stream()
                .map(WorkOrderResponse::from)
                .toList();
    }

    @Transactional
    public WorkOrderResponse updateStatus(String id, String status) {
        WorkOrder workOrder = workOrderRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Work order not found: " + id));

        workOrder.setStatus(status);

        if ("resolved".equals(status) || "closed".equals(status)) {
            workOrder.setResolvedAt(OffsetDateTime.now());
        }

        workOrder = workOrderRepository.save(workOrder);

        log.info("Work order status updated: workOrderId={} status={}", workOrder.getId(), status);

        return WorkOrderResponse.from(workOrder);
    }

    private static void requireField(String value, String name) {
        if (value == null || value.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, name + " is required");
        }
    }
}

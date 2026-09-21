package com.meridian.workflow.service;

import com.meridian.workflow.domain.WorkOrder;
import com.meridian.workflow.dto.CreateWorkOrderDto;
import com.meridian.workflow.dto.WorkOrderResponse;
import com.meridian.workflow.messaging.EventPublisher;
import com.meridian.workflow.repository.WorkOrderRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
public class WorkOrderService {

    private static final Logger log = LoggerFactory.getLogger(WorkOrderService.class);

    private final WorkOrderRepository workOrderRepository;
    private final EventPublisher eventPublisher;

    public WorkOrderService(WorkOrderRepository workOrderRepository, EventPublisher eventPublisher) {
        this.workOrderRepository = workOrderRepository;
        this.eventPublisher = eventPublisher;
    }

    /**
     * Channel 1: User-initiated Work Order (via Public Portal/API)
     */
    @Transactional
    public WorkOrderResponse createWorkOrder(CreateWorkOrderDto request) {
        WorkOrder workOrder = WorkOrder.createFromRequest(
                request.requestId(),
                request.citizenId(),
                request.title(),
                request.department(),
                request.priority(),
                request.zoneId()
        );

        workOrder = workOrderRepository.save(workOrder);
        
        // Emit Event: work_order.created
        eventPublisher.publishEvent(workOrder.getId(), "work_order", "work_order.created");

        log.info("User-initiated work order created: workOrderId={} requestId={}", workOrder.getId(), workOrder.getRequestId());

        return WorkOrderResponse.from(workOrder);
    }

    /**
     * Channel 2: System-initiated Work Order (triggered by an Incident)
     * This is the critical path for the Generic Engine's automated flows.
     */
    @Transactional
    public WorkOrderResponse createWorkOrderFromIncident(String incidentId, String title, String department, String priority, String zoneId) {
        WorkOrder workOrder = WorkOrder.createFromIncident(
                incidentId,
                title,
                department,
                priority,
                zoneId
        );

        workOrder = workOrderRepository.save(workOrder);
        
        // Emit Event: work_order.created
        eventPublisher.publishEvent(workOrder.getId(), "work_order", "work_order.created");

        log.info("System-initiated work order created from incident: workOrderId={} incidentId={}", workOrder.getId(), incidentId);

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
    public List<WorkOrderResponse> listByStatus(String status) {
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
        workOrder = workOrderRepository.save(workOrder);
        
        // Emit Event: {status} (e.g., work_order.resolved)
        eventPublisher.publishEvent(workOrder.getId(), "work_order", status);

        log.info("Work order status updated: workOrderId={} status={}", workOrder.getId(), status);

        return WorkOrderResponse.from(workOrder);
    }
}

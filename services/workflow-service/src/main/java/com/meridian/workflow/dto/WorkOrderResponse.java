package com.meridian.workflow.dto;

import com.meridian.workflow.domain.WorkOrder;

import java.time.OffsetDateTime;

public record WorkOrderResponse(
        String id,
        String incidentId,
        String requestId,
        String title,
        String assignedDepartment,
        String assignedTo,
        String status,
        String priority,
        String zoneId,
        OffsetDateTime createdAt
) {
    public static WorkOrderResponse from(WorkOrder workOrder) {
        return new WorkOrderResponse(
                workOrder.getId(),
                workOrder.getIncidentId(),
                workOrder.getRequestId(),
                workOrder.getTitle(),
                workOrder.getAssignedDepartment(),
                workOrder.getAssignedTo(),
                workOrder.getStatus(),
                workOrder.getPriority(),
                workOrder.getZoneId(),
                workOrder.getCreatedAt()
        );
    }
}

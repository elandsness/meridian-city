package com.meridian.workflow.dto;

import com.meridian.workflow.domain.ServiceRequest;

import java.time.OffsetDateTime;

public record ServiceRequestResponse(
        String id,
        String citizenId,
        String category,
        String priority,
        String status,
        String title,
        String description,
        String zoneId,
        String assignedDepartment,
        OffsetDateTime createdAt
) {
    public static ServiceRequestResponse from(ServiceRequest request) {
        return new ServiceRequestResponse(
                request.getId(),
                request.getCitizenId(),
                request.getCategory(),
                request.getPriority(),
                request.getStatus(),
                request.getTitle(),
                request.getDescription(),
                request.getZoneId(),
                request.getAssignedDepartment(),
                request.getCreatedAt()
        );
    }
}

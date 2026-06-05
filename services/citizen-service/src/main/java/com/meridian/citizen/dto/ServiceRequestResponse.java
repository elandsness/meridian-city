package com.meridian.citizen.dto;

import com.meridian.citizen.domain.ServiceRequest;

import java.time.OffsetDateTime;

public record ServiceRequestResponse(
        String id,
        String citizenId,
        String category,
        String priority,
        String status,
        String title,
        String description,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
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
                request.getCreatedAt(),
                request.getUpdatedAt()
        );
    }
}

package com.meridian.workflow.dto;

import com.meridian.workflow.domain.Incident;

import java.time.OffsetDateTime;

public record IncidentResponse(
        String id,
        String assetId,
        String source,
        String severity,
        String status,
        String title,
        String description,
        OffsetDateTime createdAt
) {
    public static IncidentResponse from(Incident incident) {
        return new IncidentResponse(
                incident.getId(),
                incident.getAssetId(),
                incident.getSource(),
                incident.getSeverity(),
                incident.getStatus(),
                incident.getTitle(),
                incident.getDescription(),
                incident.getCreatedAt()
        );
    }
}

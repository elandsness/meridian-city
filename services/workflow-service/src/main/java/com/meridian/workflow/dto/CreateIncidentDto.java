package com.meridian.workflow.dto;

public record CreateIncidentDto(
        String assetId,
        String source,
        String severity,
        String title,
        String description
) {}

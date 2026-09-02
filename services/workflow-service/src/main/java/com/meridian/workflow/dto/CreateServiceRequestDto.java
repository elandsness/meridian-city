package com.meridian.workflow.dto;

public record CreateServiceRequestDto(
        String citizenId,
        String category,
        String priority,
        String title,
        String description,
        String zoneId
) {}

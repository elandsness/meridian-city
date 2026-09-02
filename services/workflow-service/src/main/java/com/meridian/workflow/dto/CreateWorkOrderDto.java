package com.meridian.workflow.dto;

public record CreateWorkOrderDto(
        String requestId,
        String citizenId,
        String title,
        String department,
        String priority,
        String zoneId
) {}

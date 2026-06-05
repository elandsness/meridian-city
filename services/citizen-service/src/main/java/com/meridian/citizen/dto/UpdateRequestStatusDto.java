package com.meridian.citizen.dto;

public record UpdateRequestStatusDto(
        String status,
        String assignedDepartment,
        String assignedTo
) {}

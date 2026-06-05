package com.meridian.citizen.dto;

public record CreateServiceRequestDto(
        String citizenId,
        String category,
        String title,
        String description,
        String zoneId,
        String priority
) {}

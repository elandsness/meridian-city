package com.meridian.citizen.dto;

public record CreateCitizenRequest(
        String firstName,
        String lastName,
        String email,
        String zoneId
) {}

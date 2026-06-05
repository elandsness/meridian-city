package com.meridian.citizen.dto;

import com.meridian.citizen.domain.Citizen;

import java.time.OffsetDateTime;

public record CitizenResponse(
        String id,
        String firstName,
        String lastName,
        String email,
        String zoneId,
        OffsetDateTime createdAt
) {
    public static CitizenResponse from(Citizen citizen) {
        return new CitizenResponse(
                citizen.getId(),
                citizen.getFirstName(),
                citizen.getLastName(),
                citizen.getEmail(),
                citizen.getZoneId(),
                citizen.getCreatedAt()
        );
    }
}

package com.meridian.identity.dto;

import com.meridian.identity.domain.Identity;

import java.time.OffsetDateTime;

public record IdentityResponse(
        String id,
        String firstName,
        String lastName,
        String email,
        String zoneId,
        OffsetDateTime createdAt
) {
    public static IdentityResponse from(Identity identity) {
        return new IdentityResponse(
                identity.getId(),
                identity.getFirstName(),
                identity.getLastName(),
                identity.getEmail(),
                identity.getZoneId(),
                identity.getCreatedAt()
        );
    }
}

package com.meridian.identity.dto;

public record CreateIdentityRequest(
        String firstName,
        String lastName,
        String email,
        String zoneId,
        // Optional: when present, a login account (BCrypt-hashed) is created for
        // the identity. Omitted by non-interactive callers (e.g. traffic-bot),
        // whose identities are then simply not loginable.
        String password
) {}

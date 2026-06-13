package com.meridian.citizen.dto;

public record CreateCitizenRequest(
        String firstName,
        String lastName,
        String email,
        String zoneId,
        // Optional: when present, a login account (BCrypt-hashed) is created for
        // the citizen. Omitted by non-interactive callers (e.g. traffic-bot),
        // whose citizens are then simply not loginable.
        String password
) {}

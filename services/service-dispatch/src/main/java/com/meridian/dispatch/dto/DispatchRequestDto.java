package com.meridian.dispatch.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
// Internal cross-service DTO: pinned to camelCase, immune to the service-wide SNAKE_CASE strategy.
@JsonNaming(PropertyNamingStrategies.LowerCamelCaseStrategy.class)
public class DispatchRequestDto {

    private String requestId;
    private String citizenId;
    private String category;
    private String priority;
    private String zoneId;

    /**
     * Absolute target times (computed by citizen-service, the flow's timeline owner) at
     * which service-dispatch should emit the dispatched/assigned business events, so the
     * Service Request flow stays realistically spaced and strictly ordered. Null when the
     * lifecycle is disabled upstream — in that case dispatch() emits both synchronously.
     */
    private OffsetDateTime dispatchedAt;
    private OffsetDateTime assignedAt;
}

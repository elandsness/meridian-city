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
public class DispatchResultDto {

    private String requestId;
    private String assignedDepartment;
    private String status;
    private OffsetDateTime dispatchedAt;
}

package com.meridian.cityops.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
// Internal cross-service DTO: pinned to camelCase, immune to the service-wide SNAKE_CASE strategy.
@JsonNaming(PropertyNamingStrategies.LowerCamelCaseStrategy.class)
public class CreateWorkOrderDto {

    private String requestId;
    private String citizenId;
    private String title;
    private String department;
    private String priority;
    private String zoneId;
}

package com.meridian.cityops.dto;

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
// Internal cross-service DTO (consumed by service-dispatch): pinned to camelCase,
// immune to the service-wide SNAKE_CASE strategy.
@JsonNaming(PropertyNamingStrategies.LowerCamelCaseStrategy.class)
public class WorkOrderResponse {

    private String id;
    private String requestId;
    private String title;
    private String assignedDepartment;
    private String status;
    private String priority;
    private OffsetDateTime createdAt;
}

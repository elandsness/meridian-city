package com.meridian.workflow.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
public record CreateWorkOrderDto(
        String requestId,
        @JsonProperty("citizen_id") String identityId,
        String title,
        String department,
        String priority,
        String zoneId
) {}

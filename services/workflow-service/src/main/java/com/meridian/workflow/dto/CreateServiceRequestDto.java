package com.meridian.workflow.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record CreateServiceRequestDto(
        @JsonProperty("citizen_id") String identityId,
        String category,
        String priority,
        String title,
        String description,
        String zoneId
) {}

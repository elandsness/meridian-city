package com.meridian.cityops.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class IncidentResponse {

    private String id;
    private String assetId;
    private String severity;
    private String status;
    private String title;
    private OffsetDateTime createdAt;
}

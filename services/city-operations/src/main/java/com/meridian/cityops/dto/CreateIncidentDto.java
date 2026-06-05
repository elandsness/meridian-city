package com.meridian.cityops.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateIncidentDto {

    private String assetId;
    private String source;
    private String severity;
    private String title;
    private String description;
}

package com.meridian.cityops.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BuildingResponse {

    private String id;
    private String name;
    private String zoneId;
    private Integer floors;
    private String status;
}

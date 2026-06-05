package com.meridian.cityops.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateWorkOrderDto {

    private String requestId;
    private String citizenId;
    private String title;
    private String department;
    private String priority;
    private String zoneId;
}

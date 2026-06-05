package com.meridian.dispatch.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DispatchRequestDto {

    private String requestId;
    private String citizenId;
    private String category;
    private String priority;
    private String zoneId;
}

package com.meridian.dispatch.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DispatchResultDto {

    private String requestId;
    private String assignedDepartment;
    private String status;
    private OffsetDateTime dispatchedAt;
}

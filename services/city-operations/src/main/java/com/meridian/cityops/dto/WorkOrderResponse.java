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
public class WorkOrderResponse {

    private String id;
    private String requestId;
    private String title;
    private String assignedDepartment;
    private String status;
    private String priority;
    private OffsetDateTime createdAt;
}

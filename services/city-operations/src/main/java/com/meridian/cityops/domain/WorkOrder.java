package com.meridian.cityops.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(schema = "incidents", name = "work_orders")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WorkOrder {

    @Id
    private String id;

    @Column(name = "incident_id")
    private String incidentId;

    @Column(name = "request_id")
    private String requestId;

    @Column(nullable = false)
    private String title;

    @Column(name = "assigned_department")
    private String assignedDepartment;

    @Column(name = "assigned_to")
    private String assignedTo;

    @Builder.Default
    private String status = "created";

    @Builder.Default
    private String priority = "normal";

    @Column(name = "zone_id")
    private String zoneId;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    @Column(name = "resolved_at")
    private OffsetDateTime resolvedAt;

    /**
     * Factory method — generates id like "wo-a1b2c".
     */
    public static WorkOrder createFromRequest(String requestId, String title,
                                               String department, String priority,
                                               String zoneId) {
        String shortId = UUID.randomUUID().toString().replace("-", "").substring(0, 5);
        return WorkOrder.builder()
                .id("wo-" + shortId)
                .requestId(requestId)
                .title(title)
                .assignedDepartment(department)
                .status("created")
                .priority(priority != null ? priority : "normal")
                .zoneId(zoneId)
                .createdAt(OffsetDateTime.now())
                .build();
    }
}

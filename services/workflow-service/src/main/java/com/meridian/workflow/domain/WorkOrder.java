package com.meridian.workflow.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;

/**
 * Represents a work order (e.g., repair request, maintenance task).
 * The lifecycle is configurable via industry config.
 */
@Entity
@Table(schema = "workflow", name = "work_orders")
@Getter
@Setter
@NoArgsConstructor
public class WorkOrder {

    @Id
    @Column(name = "id", length = 50)
    private String id;

    @Column(name = "incident_id", length = 50)
    private String incidentId;

    @Column(name = "request_id", length = 50)
    private String requestId;

    @Column(name = "title", nullable = false, length = 255)
    private String title;

    @Column(name = "assigned_department", length = 100)
    private String assignedDepartment;

    @Column(name = "assigned_to", length = 100)
    private String assignedTo;

    @Column(name = "status", length = 30)
    private String status;

    @Column(name = "priority", length = 20)
    private String priority;

    @Column(name = "zone_id", length = 50)
    private String zoneId;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    @Column(name = "resolved_at")
    private OffsetDateTime resolvedAt;

    @Column(name = "assigned_at")
    private OffsetDateTime assignedAt;

    @Column(name = "acknowledged_at")
    private OffsetDateTime acknowledgedAt;

    @Column(name = "next_transition_at")
    private OffsetDateTime nextTransitionAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = OffsetDateTime.now();
        }
        if (status == null) {
            status = "created";
        }
    }

    public static WorkOrder createFromRequest(String requestId, String citizenId, String title, String department, String priority, String zoneId) {
        WorkOrder workOrder = new WorkOrder();
        workOrder.setId("wo-" + generateSuffix());
        workOrder.setRequestId(requestId);
        workOrder.setTitle(title);
        workOrder.setAssignedDepartment(department);
        workOrder.setPriority(priority != null ? priority : "normal");
        workOrder.setZoneId(zoneId);
        workOrder.setStatus("created");
        return workOrder;
    }

    public static WorkOrder createFromIncident(String incidentId, String title, String department, String priority, String zoneId) {
        WorkOrder workOrder = new WorkOrder();
        workOrder.setId("wo-" + generateSuffix());
        workOrder.setIncidentId(incidentId);
        workOrder.setTitle(title);
        workOrder.setAssignedDepartment(department);
        workOrder.setPriority(priority != null ? priority : "normal");
        workOrder.setZoneId(zoneId);
        workOrder.setStatus("awaiting_incident");
        return workOrder;
    }

    private static String generateSuffix() {
        String ALPHANUMERIC = "abcdefghijklmnopqrstuvwxyz0123456789";
        java.util.Random RANDOM = new java.util.Random();
        StringBuilder sb = new StringBuilder(5);
        for (int i = 0; i < 5; i++) {
            sb.append(ALPHANUMERIC.charAt(RANDOM.nextInt(ALPHANUMERIC.length())));
        }
        return sb.toString();
    }
}

package com.meridian.workflow.domain;

import jakarta.persistence.*;
import java.time.OffsetDateTime;

@Entity
@Table(schema = "workflow", name = "work_orders")
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

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getIncidentId() { return incidentId; }
    public void setIncidentId(String incidentId) { this.incidentId = incidentId; }

    public String getRequestId() { return requestId; }
    public void setRequestId(String requestId) { this.requestId = requestId; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getAssignedDepartment() { return assignedDepartment; }
    public void setAssignedDepartment(String assignedDepartment) { this.assignedDepartment = assignedDepartment; }

    public String getAssignedTo() { return assignedTo; }
    public void setAssignedTo(String assignedTo) { this.assignedTo = assignedTo; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getPriority() { return priority; }
    public void setPriority(String priority) { this.priority = priority; }

    public String getZoneId() { return zoneId; }
    public void setZoneId(String zoneId) { this.zoneId = zoneId; }

    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }

    public OffsetDateTime getResolvedAt() { return resolvedAt; }
    public void setResolvedAt(OffsetDateTime resolvedAt) { this.resolvedAt = resolvedAt; }

    public OffsetDateTime getAssignedAt() { return assignedAt; }
    public void setAssignedAt(OffsetDateTime assignedAt) { this.assignedAt = assignedAt; }

    public OffsetDateTime getAcknowledgedAt() { return acknowledgedAt; }
    public void setAcknowledgedAt(OffsetDateTime acknowledgedAt) { this.acknowledgedAt = acknowledgedAt; }

    public OffsetDateTime getNextTransitionAt() { return nextTransitionAt; }
    public void setNextTransitionAt(OffsetDateTime nextTransitionAt) { this.nextTransitionAt = nextTransitionAt; }

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = OffsetDateTime.now();
        }
        if (status == null) {
            status = "created";
        }
    }

    public static WorkOrder createFromRequest(String requestId, String title, String department, String priority, String zoneId) {
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

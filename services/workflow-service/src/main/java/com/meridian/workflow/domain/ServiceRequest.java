package com.meridian.workflow.domain;

import jakarta.persistence.*;
import java.time.OffsetDateTime;

@Entity
@Table(schema = "workflow", name = "service_requests")
public class ServiceRequest {

    @Id
    @Column(name = "id", length = 50)
    private String id;

    @Column(name = "citizen_id", nullable = false, length = 50)
    private String identityId;

    @Column(name = "category", nullable = false, length = 50)
    private String category;

    @Column(name = "priority", length = 20)
    private String priority;

    @Column(name = "status", length = 30)
    private String status;

    @Column(name = "title", nullable = false, length = 255)
    private String title;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "zone_id", length = 50)
    private String zoneId;

    @Column(name = "assigned_department", length = 100)
    private String assignedDepartment;

    @Column(name = "assigned_to", length = 100)
    private String assignedTo;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;

    @Column(name = "resolved_at")
    private OffsetDateTime resolvedAt;

    @Column(name = "lifecycle_stage", length = 30)
    private String lifecycleStage;

    @Column(name = "next_transition_at")
    private OffsetDateTime nextTransitionAt;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getIdentityId() { return identityId; }
    public void setIdentityId(String identityId) { this.identityId = identityId; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public String getPriority() { return priority; }
    public void setPriority(String priority) { this.priority = priority; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getZoneId() { return zoneId; }
    public void setZoneId(String zoneId) { this.zoneId = zoneId; }

    public String getAssignedDepartment() { return assignedDepartment; }
    public void setAssignedDepartment(String assignedDepartment) { this.assignedDepartment = assignedDepartment; }

    public String getAssignedTo() { return assignedTo; }
    public void setAssignedTo(String assignedTo) { this.assignedTo = assignedTo; }

    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }

    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; }

    public OffsetDateTime getResolvedAt() { return resolvedAt; }
    public void setResolvedAt(OffsetDateTime resolvedAt) { this.resolvedAt = resolvedAt; }

    public String getLifecycleStage() { return lifecycleStage; }
    public void setLifecycleStage(String lifecycleStage) { this.lifecycleStage = lifecycleStage; }

    public OffsetDateTime getNextTransitionAt() { return nextTransitionAt; }
    public void setNextTransitionAt(OffsetDateTime nextTransitionAt) { this.nextTransitionAt = nextTransitionAt; }

    @PrePersist
    protected void onCreate() {
        OffsetDateTime now = OffsetDateTime.now();
        if (createdAt == null) {
            createdAt = now;
        }
        updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = OffsetDateTime.now();
    }

    public static ServiceRequest create(String identityId, String category, String priority, String title, String description, String zoneId) {
        ServiceRequest request = new ServiceRequest();
        request.setId("req-" + generateSuffix());
        request.setIdentityId(identityId);
        request.setCategory(category);
        request.setPriority(priority != null ? priority : "normal");
        request.setTitle(title);
        request.setDescription(description);
        request.setZoneId(zoneId);
        request.setStatus("submitted");
        request.setLifecycleStage("submitted");
        return request;
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

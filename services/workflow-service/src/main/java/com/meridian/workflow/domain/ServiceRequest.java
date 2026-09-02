package com.meridian.workflow.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;

/**
 * Represents a citizen service request (e.g., pothole report, noise complaint).
 * The lifecycle is configurable via industry config.
 */
@Entity
@Table(schema = "workflow", name = "service_requests")
@Getter
@Setter
@NoArgsConstructor
public class ServiceRequest {

    @Id
    @Column(name = "id", length = 50)
    private String id;

    @Column(name = "citizen_id", nullable = false, length = 50)
    private String citizenId;

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

    public static ServiceRequest create(String citizenId, String category, String priority, String title, String description, String zoneId) {
        ServiceRequest request = new ServiceRequest();
        request.setId("req-" + generateSuffix());
        request.setCitizenId(citizenId);
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

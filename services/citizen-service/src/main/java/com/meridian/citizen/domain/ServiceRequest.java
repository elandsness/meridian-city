package com.meridian.citizen.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;
import java.util.Random;

@Entity
@Table(schema = "requests", name = "service_requests")
@Getter
@Setter
@NoArgsConstructor
public class ServiceRequest {

    private static final String ALPHANUMERIC = "abcdefghijklmnopqrstuvwxyz0123456789";
    private static final Random RANDOM = new Random();

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

    public static ServiceRequest create(String citizenId, String category, String title,
                                        String description, String zoneId, String priority) {
        ServiceRequest request = new ServiceRequest();
        request.setId("req-" + generateSuffix());
        request.setCitizenId(citizenId);
        request.setCategory(category);
        request.setTitle(title);
        request.setDescription(description);
        request.setZoneId(zoneId);
        request.setPriority(priority != null ? priority : "normal");
        request.setStatus("submitted");
        return request;
    }

    private static String generateSuffix() {
        StringBuilder sb = new StringBuilder(5);
        for (int i = 0; i < 5; i++) {
            sb.append(ALPHANUMERIC.charAt(RANDOM.nextInt(ALPHANUMERIC.length())));
        }
        return sb.toString();
    }
}

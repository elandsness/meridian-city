package com.meridian.workflow.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;

/**
 * Represents an incident (e.g., accident, natural disaster, system failure).
 * The lifecycle is configurable via industry config.
 */
@Entity
@Table(schema = "workflow", name = "incidents")
@Getter
@Setter
@NoArgsConstructor
public class Incident {

    @Id
    @Column(name = "id", length = 50)
    private String id;

    @Column(name = "asset_id", length = 50)
    private String assetId;

    @Column(name = "source", length = 30)
    private String source;

    @Column(name = "severity", length = 20)
    private String severity;

    @Column(name = "status", length = 30)
    private String status;

    @Column(name = "title", nullable = false, length = 255)
    private String title;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    @Column(name = "resolved_at")
    private OffsetDateTime resolvedAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = OffsetDateTime.now();
        }
        if (source == null) {
            source = "manual";
        }
        if (severity == null) {
            severity = "medium";
        }
        if (status == null) {
            status = "open";
        }
    }

    public static Incident create(String assetId, String source, String severity, String title, String description) {
        Incident incident = new Incident();
        incident.setId("inc-" + generateSuffix());
        incident.setAssetId(assetId);
        incident.setSource(source);
        incident.setSeverity(severity);
        incident.setTitle(title);
        incident.setDescription(description);
        return incident;
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

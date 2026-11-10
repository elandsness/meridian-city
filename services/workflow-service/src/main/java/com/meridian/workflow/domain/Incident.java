package com.meridian.workflow.domain;

import jakarta.persistence.*;
import java.time.OffsetDateTime;

@Entity
@Table(schema = "workflow", name = "incidents")
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

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getAssetId() { return assetId; }
    public void setAssetId(String assetId) { this.assetId = assetId; }

    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }

    public String getSeverity() { return severity; }
    public void setSeverity(String severity) { this.severity = severity; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }

    public OffsetDateTime getResolvedAt() { return resolvedAt; }
    public void setResolvedAt(OffsetDateTime resolvedAt) { this.resolvedAt = resolvedAt; }

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

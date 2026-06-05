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
@Table(schema = "incidents", name = "incidents")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Incident {

    @Id
    private String id;

    @Column(name = "asset_id")
    private String assetId;

    @Builder.Default
    private String source = "manual";

    @Builder.Default
    private String severity = "medium";

    @Builder.Default
    private String status = "open";

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    @Column(name = "resolved_at")
    private OffsetDateTime resolvedAt;

    /**
     * Factory method — generates id like "inc-a1b2c".
     */
    public static Incident create(String assetId, String source, String severity,
                                   String title, String description) {
        String shortId = UUID.randomUUID().toString().replace("-", "").substring(0, 5);
        return Incident.builder()
                .id("inc-" + shortId)
                .assetId(assetId)
                .source(source != null ? source : "manual")
                .severity(severity != null ? severity : "medium")
                .status("open")
                .title(title)
                .description(description)
                .createdAt(OffsetDateTime.now())
                .build();
    }
}

package com.meridian.workflow.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;

/**
 * Represents a city asset (e.g., building, vehicle, infrastructure).
 */
@Entity
@Table(schema = "workflow", name = "assets")
@Getter
@Setter
@NoArgsConstructor
public class Asset {

    @Id
    @Column(name = "id", length = 50)
    private String id;

    @Column(name = "name", nullable = false, length = 255)
    private String name;

    @Column(name = "asset_type", nullable = false, length = 50)
    private String assetType;

    @Column(name = "zone_id", length = 50)
    private String zoneId;

    @Column(name = "status", length = 30)
    private String status;

    @Column(name = "metadata", columnDefinition = "jsonb")
    private String metadata;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = OffsetDateTime.now();
        }
        if (status == null) {
            status = "operational";
        }
    }

    public static Asset create(String name, String assetType, String zoneId) {
        Asset asset = new Asset();
        asset.setId("asset-" + generateSuffix());
        asset.setName(name);
        asset.setAssetType(assetType);
        asset.setZoneId(zoneId);
        return asset;
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

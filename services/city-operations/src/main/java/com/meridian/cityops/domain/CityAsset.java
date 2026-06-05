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

@Entity
@Table(schema = "city", name = "assets")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CityAsset {

    @Id
    private String id;

    @Column(nullable = false)
    private String name;

    @Column(name = "asset_type", nullable = false)
    private String assetType;

    @Column(name = "zone_id")
    private String zoneId;

    @Builder.Default
    private String status = "operational";

    @Column(columnDefinition = "TEXT")
    private String metadata;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;
}

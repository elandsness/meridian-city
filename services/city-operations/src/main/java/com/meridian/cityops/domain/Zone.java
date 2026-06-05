package com.meridian.cityops.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(schema = "city", name = "zones")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Zone {

    @Id
    private String id;

    @Column(nullable = false)
    private String name;

    @Column(name = "zone_type")
    private String zoneType;

    @Column(columnDefinition = "TEXT")
    private String geojson;
}

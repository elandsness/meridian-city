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
@Table(schema = "city", name = "buildings")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Building {

    @Id
    private String id;

    private String name;

    @Column(name = "zone_id")
    private String zoneId;

    private Integer floors;

    @Column(name = "year_built")
    private Integer yearBuilt;

    private String address;
}

package com.meridian.commerce.domain;

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
@Table(schema = "commerce", name = "products")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Product {

    @Id
    private String id;

    private String sku;

    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "price_cents")
    private int priceCents;

    @Column(name = "image_key")
    private String imageKey;

    private boolean active;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;
}

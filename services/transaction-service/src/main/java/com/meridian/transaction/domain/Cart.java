package com.meridian.transaction.domain;

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
@Table(schema = "transaction", name = "carts")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Cart {

    @Id
    private String id;

    @Column(name = "identity_id")
    private String identityId;

    @Builder.Default
    private String status = "open";

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;

    /** Factory — generates id like "cart-a1b2c". */
    public static Cart create(String identityId) {
        String shortId = UUID.randomUUID().toString().replace("-", "").substring(0, 5);
        OffsetDateTime now = OffsetDateTime.now();
        return Cart.builder()
                .id("cart-" + shortId)
                .identityId(identityId)
                .status("open")
                .createdAt(now)
                .updatedAt(now)
                .build();
    }
}

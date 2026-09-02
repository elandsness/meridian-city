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
@Table(schema = "transaction", name = "cart_items")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CartItem {

    @Id
    private String id;

    @Column(name = "cart_id")
    private String cartId;

    @Column(name = "product_id")
    private String productId;

    @Column(name = "product_name")
    private String productName;

    @Column(name = "quantity")
    private int quantity;

    @Column(name = "unit_price_cents")
    private int unitPriceCents;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    /** Factory — generates id like "citem-a1b2c". */
    public static CartItem create(String cartId, String productId, String productName,
                                  int quantity, int unitPriceCents) {
        String shortId = UUID.randomUUID().toString().replace("-", "").substring(0, 5);
        return CartItem.builder()
                .id("citem-" + shortId)
                .cartId(cartId)
                .productId(productId)
                .productName(productName)
                .quantity(quantity)
                .unitPriceCents(unitPriceCents)
                .createdAt(OffsetDateTime.now())
                .build();
    }
}

package com.meridian.transaction.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(schema = "transaction", name = "order_items")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrderItem {

    @Id
    private String id;

    @Column(name = "order_id")
    private String orderId;

    @Column(name = "product_id")
    private String productId;

    @Column(name = "product_name")
    private String productName;

    @Column(name = "quantity")
    private int quantity;

    @Column(name = "unit_price_cents")
    private int unitPriceCents;

    /** Factory — generates id like "oitem-a1b2c". */
    public static OrderItem create(String orderId, String productId, String productName,
                                   int quantity, int unitPriceCents) {
        String shortId = UUID.randomUUID().toString().replace("-", "").substring(0, 5);
        return OrderItem.builder()
                .id("oitem-" + shortId)
                .orderId(orderId)
                .productId(productId)
                .productName(productName)
                .quantity(quantity)
                .unitPriceCents(unitPriceCents)
                .build();
    }
}

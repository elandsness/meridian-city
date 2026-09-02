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

/**
 * Generic order entity — the result of a checkout from a cart. Carries the cart_id
 * as a correlation key for the purchase flow.
 */
@Entity
@Table(schema = "transaction", name = "orders")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Order {

    @Id
    private String id;

    @Column(name = "identity_id")
    private String identityId;

    /** The cart this order was checked out from; correlation key for the purchase flow. */
    @Column(name = "cart_id")
    private String cartId;

    @Builder.Default
    private String status = "placed";

    @Column(name = "total_cents")
    private int totalCents;

    @Column(name = "item_count")
    private int itemCount;

    @Column(name = "placed_at")
    private OffsetDateTime placedAt;

    @Column(name = "packed_at")
    private OffsetDateTime packedAt;

    @Column(name = "shipped_at")
    private OffsetDateTime shippedAt;

    @Column(name = "delivered_at")
    private OffsetDateTime deliveredAt;

    @Column(name = "next_transition_at")
    private OffsetDateTime nextTransitionAt;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;

    /** Factory — generates id like "ord-a1b2c". */
    public static Order create(String identityId, String cartId, int totalCents, int itemCount) {
        String shortId = UUID.randomUUID().toString().replace("-", "").substring(0, 5);
        OffsetDateTime now = OffsetDateTime.now();
        return Order.builder()
                .id("ord-" + shortId)
                .identityId(identityId)
                .cartId(cartId)
                .status("placed")
                .totalCents(totalCents)
                .itemCount(itemCount)
                .placedAt(now)
                .createdAt(now)
                .updatedAt(now)
                .build();
    }
}

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
 * Payment record — tracks the outcome of a bill payment attempt. Used for the
 * payment_failed business flow error branch.
 */
@Entity
@Table(schema = "transaction", name = "payments")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Payment {

    @Id
    private String id;

    @Column(name = "identity_id")
    private String identityId;

    @Column(name = "bill_id")
    private String billId;

    @Column(name = "amount_cents")
    private int amountCents;

    @Builder.Default
    private String status = "completed";

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    public static Payment create(String identityId, String billId, int amountCents, String status) {
        String shortId = UUID.randomUUID().toString().replace("-", "").substring(0, 5);
        return Payment.builder()
                .id("pay-" + shortId)
                .identityId(identityId)
                .billId(billId)
                .amountCents(amountCents)
                .status(status)
                .createdAt(OffsetDateTime.now())
                .build();
    }
}

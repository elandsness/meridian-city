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
 * Generic bill entity — replaces the former TaxBill. The period, amount, and status
 * transitions are driven by configurable rules rather than hardcoded domain concepts.
 * In an airport, this could represent a landing fee; in a bank, a regulatory fee; etc.
 */
@Entity
@Table(schema = "transaction", name = "bills")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Bill {

    @Id
    private String id;

    @Column(name = "identity_id")
    private String identityId;

    private String period;

    @Column(name = "amount_cents")
    private int amountCents;

    @Builder.Default
    private String status = "outstanding";

    @Column(name = "issued_at")
    private OffsetDateTime issuedAt;

    @Column(name = "due_at")
    private OffsetDateTime dueAt;

    @Column(name = "paid_at")
    private OffsetDateTime paidAt;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    public static String newId() {
        return "bill-" + UUID.randomUUID().toString().replace("-", "").substring(0, 5);
    }
}

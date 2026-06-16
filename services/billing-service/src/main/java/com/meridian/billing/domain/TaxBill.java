package com.meridian.billing.domain;

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
@Table(schema = "billing", name = "tax_bills")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TaxBill {

    @Id
    private String id;

    @Column(name = "citizen_id")
    private String citizenId;

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

package com.meridian.billing.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;

/** Emitted as snake_case via the global Jackson SNAKE_CASE strategy. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BillResponse {
    private String id;
    private String citizenId;
    private String period;
    private int amountCents;
    private String status;
    private OffsetDateTime issuedAt;
    private OffsetDateTime dueAt;
    private OffsetDateTime paidAt;
}

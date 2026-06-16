package com.meridian.commerce.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Request body for POST /api/v1/store/checkout (snake_case key: citizen_id). No payment/address. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CheckoutDto {
    private String citizenId;
}

package com.meridian.transaction.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Emitted as snake_case via the global Jackson SNAKE_CASE strategy. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CheckoutDto {

    private String identityId;
}

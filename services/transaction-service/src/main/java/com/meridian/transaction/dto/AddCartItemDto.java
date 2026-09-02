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
public class AddCartItemDto {

    private String identityId;
    private String productId;
    private String productName;
    private int quantity;
    private int unitPriceCents;
}

package com.meridian.commerce.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Request body for POST /api/v1/store/cart/items (snake_case keys: citizen_id, product_id, quantity). */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AddCartItemDto {
    private String citizenId;
    private String productId;
    private Integer quantity;
}

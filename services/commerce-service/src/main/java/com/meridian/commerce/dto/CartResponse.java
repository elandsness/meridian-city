package com.meridian.commerce.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/** Emitted as snake_case via the global Jackson SNAKE_CASE strategy. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CartResponse {

    private String cartId;
    private String citizenId;
    private List<Line> items;
    private int itemCount;
    private int subtotalCents;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Line {
        private String productId;
        private String name;
        private int quantity;
        private int unitPriceCents;
        private int lineTotalCents;
    }
}

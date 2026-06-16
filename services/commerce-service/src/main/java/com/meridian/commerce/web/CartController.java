package com.meridian.commerce.web;

import com.meridian.commerce.dto.AddCartItemDto;
import com.meridian.commerce.dto.CartResponse;
import com.meridian.commerce.service.CartService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/store/cart")
@RequiredArgsConstructor
public class CartController {

    private final CartService cartService;

    @GetMapping
    public CartResponse getCart(@RequestParam(name = "citizen_id", required = false) String citizenId) {
        return cartService.getCart(citizenId);
    }

    @PostMapping("/items")
    public CartResponse addItem(@RequestBody AddCartItemDto dto) {
        return cartService.addItem(dto.getCitizenId(), dto.getProductId(), dto.getQuantity());
    }

    @DeleteMapping("/items/{productId}")
    public CartResponse removeItem(@PathVariable String productId,
                                   @RequestParam(name = "citizen_id", required = false) String citizenId) {
        return cartService.removeItem(citizenId, productId);
    }
}

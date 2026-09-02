package com.meridian.transaction.web;

import com.meridian.transaction.dto.AddCartItemDto;
import com.meridian.transaction.dto.CartResponse;
import com.meridian.transaction.service.CartService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/transaction/cart")
@RequiredArgsConstructor
public class CartController {

    private final CartService cartService;

    @PostMapping("/items")
    @ResponseStatus(HttpStatus.CREATED)
    public CartResponse addItem(@RequestBody AddCartItemDto dto) {
        return cartService.addItem(dto);
    }

    @GetMapping
    public CartResponse get(@RequestParam(name = "identity_id", required = false) String identityId) {
        return cartService.getCart(identityId);
    }

    @GetMapping("/list")
    public List<CartResponse> list(@RequestParam(name = "identity_id", required = false) String identityId) {
        return cartService.listCarts(identityId);
    }

    @DeleteMapping
    public void clear(@RequestParam(name = "identity_id", required = false) String identityId) {
        cartService.clearCart(identityId);
    }
}

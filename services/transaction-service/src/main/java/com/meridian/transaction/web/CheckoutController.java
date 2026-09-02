package com.meridian.transaction.web;

import com.meridian.transaction.dto.CheckoutDto;
import com.meridian.transaction.dto.OrderResponse;
import com.meridian.transaction.service.OrderService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/transaction")
@RequiredArgsConstructor
public class CheckoutController {

    private final OrderService orderService;

    @PostMapping("/checkout")
    @ResponseStatus(HttpStatus.CREATED)
    public OrderResponse checkout(@RequestBody CheckoutDto dto) {
        return orderService.checkout(dto.getIdentityId());
    }
}

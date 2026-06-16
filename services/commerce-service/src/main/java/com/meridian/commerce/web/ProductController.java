package com.meridian.commerce.web;

import com.meridian.commerce.dto.ProductResponse;
import com.meridian.commerce.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/store")
@RequiredArgsConstructor
public class ProductController {

    private final ProductRepository productRepository;

    @GetMapping("/products")
    public List<ProductResponse> products() {
        return productRepository.findByActiveTrueOrderByPriceCentsAsc().stream()
                .map(p -> ProductResponse.builder()
                        .id(p.getId())
                        .sku(p.getSku())
                        .name(p.getName())
                        .description(p.getDescription())
                        .priceCents(p.getPriceCents())
                        .imageKey(p.getImageKey())
                        .build())
                .toList();
    }
}

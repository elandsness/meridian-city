package com.meridian.commerce.service;

import com.meridian.commerce.domain.Cart;
import com.meridian.commerce.domain.CartItem;
import com.meridian.commerce.domain.Product;
import com.meridian.commerce.dto.CartResponse;
import com.meridian.commerce.messaging.OrderEventPublisher;
import com.meridian.commerce.repository.CartItemRepository;
import com.meridian.commerce.repository.CartRepository;
import com.meridian.commerce.repository.ProductRepository;
import com.meridian.commerce.util.BusinessEventLogger;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class CartService {

    private final ProductRepository productRepository;
    private final CartRepository cartRepository;
    private final CartItemRepository cartItemRepository;
    private final BusinessEventLogger businessEventLogger;
    private final OrderEventPublisher orderEventPublisher;

    @Transactional(readOnly = true)
    public CartResponse getCart(String citizenId) {
        if (citizenId == null || citizenId.isBlank()) {
            return emptyCart(citizenId);
        }
        return cartRepository.findFirstByCitizenIdAndStatusOrderByCreatedAtDesc(citizenId, "open")
                .map(cart -> toCartResponse(cart, cartItemRepository.findByCartId(cart.getId())))
                .orElseGet(() -> emptyCart(citizenId));
    }

    @Transactional
    public CartResponse addItem(String citizenId, String productId, Integer quantity) {
        if (citizenId == null || citizenId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "citizen_id is required");
        }
        int qty = (quantity == null || quantity < 1) ? 1 : quantity;
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "product not found: " + productId));

        Cart cart = getOrCreateCart(citizenId);
        CartItem item = cartItemRepository.findByCartIdAndProductId(cart.getId(), productId).orElse(null);
        if (item == null) {
            item = CartItem.builder()
                    .cartId(cart.getId())
                    .productId(productId)
                    .quantity(qty)
                    .unitPriceCents(product.getPriceCents())
                    .build();
        } else {
            item.setQuantity(item.getQuantity() + qty);
            item.setUnitPriceCents(product.getPriceCents());
        }
        cartItemRepository.save(item);
        cart.setUpdatedAt(OffsetDateTime.now());
        cartRepository.save(cart);

        businessEventLogger.cartItemAdded(cart.getId(), citizenId, productId, qty);
        orderEventPublisher.publishCartItemAdded(cart.getId(), citizenId, productId, qty);

        return toCartResponse(cart, cartItemRepository.findByCartId(cart.getId()));
    }

    @Transactional
    public CartResponse removeItem(String citizenId, String productId) {
        Cart cart = cartRepository.findFirstByCitizenIdAndStatusOrderByCreatedAtDesc(citizenId, "open").orElse(null);
        if (cart == null) {
            return emptyCart(citizenId);
        }
        cartItemRepository.findByCartIdAndProductId(cart.getId(), productId)
                .ifPresent(cartItemRepository::delete);
        cart.setUpdatedAt(OffsetDateTime.now());
        cartRepository.save(cart);
        return toCartResponse(cart, cartItemRepository.findByCartId(cart.getId()));
    }

    Cart getOrCreateCart(String citizenId) {
        return cartRepository.findFirstByCitizenIdAndStatusOrderByCreatedAtDesc(citizenId, "open")
                .orElseGet(() -> cartRepository.save(Cart.create(citizenId)));
    }

    private CartResponse emptyCart(String citizenId) {
        return CartResponse.builder()
                .cartId(null)
                .citizenId(citizenId)
                .items(List.of())
                .itemCount(0)
                .subtotalCents(0)
                .build();
    }

    private CartResponse toCartResponse(Cart cart, List<CartItem> items) {
        Set<String> productIds = items.stream().map(CartItem::getProductId).collect(Collectors.toSet());
        Map<String, String> names = productRepository.findAllById(productIds).stream()
                .collect(Collectors.toMap(Product::getId, Product::getName));

        List<CartResponse.Line> lines = items.stream()
                .map(it -> CartResponse.Line.builder()
                        .productId(it.getProductId())
                        .name(names.getOrDefault(it.getProductId(), it.getProductId()))
                        .quantity(it.getQuantity())
                        .unitPriceCents(it.getUnitPriceCents())
                        .lineTotalCents(it.getUnitPriceCents() * it.getQuantity())
                        .build())
                .toList();

        int subtotal = lines.stream().mapToInt(CartResponse.Line::getLineTotalCents).sum();
        int count = lines.stream().mapToInt(CartResponse.Line::getQuantity).sum();

        return CartResponse.builder()
                .cartId(cart.getId())
                .citizenId(cart.getCitizenId())
                .items(lines)
                .itemCount(count)
                .subtotalCents(subtotal)
                .build();
    }
}
